// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import DB from "../db";
import { Env } from "../env";
import { Config, Projects } from "../config";
import Intra from "../utils/intra";
import Logger, { LogType } from "../utils/logger";
import Raven from "raven";
import prettyMilliseconds from "pretty-ms";
import { App, LogLevel, RespondFn, SlashCommand } from "@slack/bolt";
import { ChatPostMessageArguments } from "@slack/web-api";
import { getFullUser, User } from "../utils/user";

/*============================================================================*/

export const slackApp = new App({
	token: Env.SLACK_TOKEN,
	appToken: Env.SLACK_APP_TOKEN,
	logLevel: LogLevel.ERROR,
	socketMode: true,
});

/*============================================================================*/

/** Utility functions for the slack bot */
export namespace SlackBot {
	/**
	 * Find the Peer++ lock that has been waiting the longest for an evaluator.
	 * @param locks The Peer++ locks.
	 * @returns The oldest lock, or undefined when there are none.
	 */
	const getHighestPriorityTeam = (locks: Intra.ScaleTeam[]): Intra.ScaleTeam | undefined => {
		let best: Intra.ScaleTeam | undefined = undefined;

		for (const scaleTeam of locks) {
			if (best === undefined || scaleTeam.createdAt.getTime() < best.createdAt.getTime()) {
				best = scaleTeam;
			}
		}

		return best;
	};

	/**
	 * Merges the Peer++ locks per project, so for example every locked libft team
	 * ends up on one row.
	 * @param locks The Peer++ locks.
	 */
	const aggregateProjects = (locks: Intra.ScaleTeam[]) => {
		const count: { [key: string]: { teamCount: number; createdAt: Date } } = {};

		for (const lock of locks) {
			if (!count[lock.projectName]) {
				count[lock.projectName] = { teamCount: 0, createdAt: new Date() };
			}

			count[lock.projectName]!.teamCount++;

			if (lock.createdAt.getTime() < count[lock.projectName]!.createdAt.getTime()) {
				count[lock.projectName]!.createdAt = lock.createdAt;
			}
		}
		return count;
	};

	/**
	 * Send a message to a given user with a given message.
	 * @param user The user to which the message is sent.
	 * @param message The message to send.
	 */
	export async function sendMessage(user: User, message: string) {
		const opt: ChatPostMessageArguments = { channel: user.slackUID, text: message };

		const response = await slackApp.client.chat.postMessage(opt);
		if (!response.ok) {
			throw new Error(`Failed to send Slack message to ${user.intraLogin}: ${response.error}`);
		}
	}

	/**
	 * Send a message straight to a Slack member ID, for recipients that have no Intra user attached.
	 * @param slackUID The Slack member ID to message.
	 * @param message The message to send.
	 */
	export async function sendMessageToSlackID(slackUID: string, message: string) {
		const opt: ChatPostMessageArguments = { channel: slackUID, text: message };

		const response = await slackApp.client.chat.postMessage(opt);
		if (!response.ok) {
			throw new Error(`Failed to send Slack message to ${slackUID}: ${response.error}`);
		}
	}

	/**
	 * Sends a message to every staff member configured in the config.
	 *
	 * Never throws: these messages report something that already happened, so a staff
	 * member with a wrong Slack ID must not break the flow that triggered them.
	 */
	async function notifyStaff(message: string) {
		for (const slackUID of Config.staffSlackIDs ?? []) {
			try {
				await SlackBot.sendMessageToSlackID(slackUID, message);
			} catch (error) {
				Raven.captureException(error instanceof Error ? error : new Error(String(error)));
				Logger.log(`Failed to notify staff member ${slackUID}: ${error}`, LogType.ERROR);
			}
		}
	}

	/**
	 * Reports a booked evaluation to the staff.
	 *
	 * @param corrector The evaluator that booked the evaluation.
	 * @param correcteds The team that will be evaluated.
	 * @param lock The reserved evaluation that was swapped out.
	 * @param evaluationDate When the evaluation itself will take place.
	 */
	export async function notifyStaffOfBooking(corrector: User, correcteds: User[], lock: Intra.ScaleTeam, evaluationDate: Date) {
		await notifyStaff(
			`A Peer++ evaluation has been booked.` +
				`\n• Booked at: \`${new Date().toISOString()}\`` +
				`\n• Booked by: \`${corrector.intraLogin}\`` +
				`\n• Team: \`${lock.teamName}\` (${correcteds.map((user) => user.intraLogin).join(", ")})` +
				`\n• Project: \`${lock.projectName}\`` +
				`\n• Evaluation at: \`${evaluationDate.toISOString()}\``
		);
	}

	/**
	 * Reports a deleted lock to the staff.
	 *
	 * @param lock The lock that was deleted.
	 * @param lockedAt When the lock was originally placed.
	 * @param reason Why the lock was deleted.
	 * @param teamLogins The logins of the team that was locked.
	 */
	export async function notifyStaffOfDeletedLock(lock: Intra.ScaleTeam, lockedAt: Date, reason: string, teamLogins: string[]) {
		await notifyStaff(
			`A Peer++ lock has been deleted.` +
				`\n• Deleted at: \`${new Date().toISOString()}\`` +
				`\n• Reason: ${reason}` +
				`\n• Team: \`${lock.teamName}\` (${teamLogins.join(", ")})` +
				`\n• Project: \`${lock.projectName}\`` +
				`\n• Locked at: \`${lockedAt.toISOString()}\``
		);
	}

	/** What `/help` tells the user about a command. */
	export interface CommandHelp {
		/** The arguments the command takes, listed behind its name. Leave out when it takes none. */
		args?: string;
		/** What the command does, in one line. */
		description: string;
	}

	/** Every registered command, in registration order, so `/help` cannot go out of date. */
	const commands: (CommandHelp & { cmd: string; evaluatorOnly: boolean })[] = [];

	/** Registers the command with Slack and lists it in `/help`, catching whatever `cb()` throws. */
	function register(cmd: string, help: CommandHelp, evaluatorOnly: boolean, cb: (respond: RespondFn, body: SlashCommand) => Promise<void> | void) {
		commands.push({ ...help, cmd, evaluatorOnly });

		slackApp.command(cmd, async (context) => {
			// Commands should always be acknowledged within 3 seconds
			await context.ack();

			try {
				await cb(context.respond, context.body);
			} catch (error) {
				Raven.captureException(error instanceof Error ? error : new Error(String(error)));
				Logger.log(`Request failed: ${error}`);
				await context.respond(`:panic: The request for command \`${cmd}\` failed with:\n${error}`);
			}
		});
	}

	/**
	 *  This function registers a command and handles exceptions.
	 *  To not use try/catch in the `cb()` function, it will be caught automatically and a message will be logged and sent to the user.
	 */
	export function registerCommand(cmd: string, help: CommandHelp, cb: (respond: RespondFn, body: SlashCommand) => Promise<void> | void) {
		register(cmd, help, false, cb);
	}

	/**
	 * Registers a command that can only be used by evaluators.
	 * It is slower than the `registerCommand()` because of the extra API call.
	 * Use `registerCommand()` if you don't need to check if the user is an Peer++ evaluator.
	 **/
	export function registerEvaluatorCommand(cmd: string, help: CommandHelp, cb: (respond: RespondFn, body: SlashCommand, invoker: User) => Promise<void> | void) {
		register(cmd, help, true, async (respond, body) => {
			const invoker = await getFullUser({ slackUID: body.user_id });

			if (!(await Intra.hasGroup(invoker.intraUID!, Config.groupID))) {
				await respond("You are not a Peer++ evaluator. Please apply! :doot:");
				return;
			}
			await cb(respond, body, invoker);
		});
	}

	/**
	 * Lists every command of the bot with what it is for, marking the ones only Peer++
	 * evaluators can use. Anyone can invoke it, so it never looks the invoker up.
	 */
	export async function displayHelp(respond: RespondFn) {
		let text = "Commands of the Peer++ bot:\n";
		for (const { cmd, args, description, evaluatorOnly } of commands) {
			text += `\`${cmd}${args ? ` ${args}` : ""}\`${evaluatorOnly ? " :lock:" : ""}\n• ${description}\n`;
		}

		text += `\n:lock: = only for Peer++ evaluators. Ask the Codam Pedago team to become one.`;
		text += `\nWhere a command takes projects, they come from \`/projects\` and are separated by a space.`;
		await respond(text);
	}

	/**
	 * Hands a Peer++ lock over to a real evaluator: deletes the bot's placeholder and books
	 * the evaluator as the corrector of the team instead.
	 * @param respond The messaging function.
	 * @param corrector The Peer++ evaluator taking the lock over.
	 * @param lock The Peer++ lock to take over.
	 */
	async function swapScaleTeams(respond: RespondFn, corrector: User, lock: Intra.ScaleTeam) {
		const correcteds: User[] = await Promise.all(lock.correcteds.map((c) => getFullUser(c)));
		if (correcteds.includes(corrector)) {
			await respond("You can't book yourself. Nice try :dongle:");
			return;
		}

		await DB.markTeamHandled(lock.teamID).catch((reason) => {
			throw new Error(reason);
		});
		Logger.log(`Deleting lock ${lock.id} for ${lock.teamName} on ${lock.projectName}`);
		await Intra.deleteEvaluation(lock);

		const evaluationDate = new Date(Date.now() + 15 * 60 * 1000);
		await Intra.bookEvaluation(lock.scaleID, lock.teamID, corrector.intraUID, evaluationDate);

		await respond(
			`You will evaluate team \`${lock.teamName}\`, consisting of ${correcteds
				.map((u) => u.intraLogin)
				.join(", ")} at ${evaluationDate}. They will be notified on slack. Please contact each other.`
		);

		for (const user of correcteds) {
			await SlackBot.sendMessage(
				user,
				`You will be evaluated by \`${corrector.intraLogin}\` on your \`${lock.projectName}\`.\nContact them to schedule a time and date for the Peer++ evaluation.\n`
			);
		}

		await SlackBot.notifyStaffOfBooking(corrector, correcteds, lock, evaluationDate);
		Logger.log(`Swapped out lock ${lock.id} for evaluation ${lock.teamName}.`);
	}

	//= Command functions =//

	/**
	 * Display every team waiting for a Peer++ evaluation, aka the teams the bot locked.
	 * @param respond The slack response function, sends a message to user.
	 */
	export async function displayEvaluations(respond: RespondFn) {
		await respond("Please wait, fetching teams waiting for a Peer++ evaluation...");

		let locks: Intra.ScaleTeam[] = await Intra.getLocks();
		if (locks.length == 0) {
			await respond("Currently no-one needs to be evaluated :feelsbadman:");
			return;
		}

		locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		const projects = aggregateProjects(locks);

		let text: string = "Projects with teams waiting for a Peer++ evaluation:\n";
		for (const project in projects) {
			const timeLocked = prettyMilliseconds(Date.now() - projects[project]!.createdAt.getTime(), {
				verbose: true,
				unitCount: 1,
			});

			text += `\`${project} | ${projects[project]!.teamCount} teams | Locked ${timeLocked} ago\`\n`;
		}
		await respond(text);
	}

	/**
	 * Display which evaluators are notified of teams waiting for a Peer++ evaluation, so it is visible
	 * where the coverage is and who to ask about a project.
	 * @param respond The slack response function, sends a message to user.
	 */
	export async function displayEvaluators(respond: RespondFn) {
		// Favorites are stored per project id, and the same name can hide several of those,
		// so an evaluator watching a name must still be listed behind it only once.
		const watchers = new Map<string, Set<string>>();
		for (const favorite of await DB.allFavorites()) {
			const name = Projects.nameOf(favorite.projectID);
			if (name === undefined) continue;

			watchers.set(name, (watchers.get(name) ?? new Set()).add(favorite.intraLogin));
		}

		const names = Projects.names();
		const watched = names.filter((name) => watchers.has(name));

		if (watched.length === 0) {
			await respond("No-one has favorited a project yet. Use the command `/notify-on <project>` to be the first.");
			return;
		}

		let text = "Peer++ evaluators that are notified of new teams waiting for a Peer++ evaluation, per project:\n";
		for (const name of watched) {
			text += `\`${name}\` - ${[...watchers.get(name)!].join(", ")}\n`;
		}
		text += `\n${names.length - watched.length} of the ${names.length} projects have no-one watching them.`;
		await respond(text);
	}

	/**
	 * Take over a Peer++ lock for the given project, becoming the corrector of that team.
	 * @param projectName The project name.
	 * @param respond The slack messaging function.
	 * @param corrector The Peer++ evaluator taking the lock over.
	 */
	export async function bookEvaluation(projectName: string, respond: RespondFn, corrector: User) {
		// Resolve the given name to its project once, so the lock lookup below cannot disagree
		// with the check here about what the user meant. Locks carry the project name lowercased.
		const project = Projects.find(projectName);
		if (!project) {
			await respond(`Project \`${Projects.clean(projectName)}\` not recognized, invoke /projects for more info`);
			return;
		}
		const name = project.name;

		// const canEvaluate = await Intra.validatedProject(corrector.intraUID, name); //||
		// await Intra.hasCompletedCore(corrector.intraLogin); // NOTE: For the future person who comes here, no sure if this thing works?
		// if (!canEvaluate) {
		// 	await respond("Sorry, you can't book a project you have not completed :sus:");
		// 	return;
		// }

		Logger.log(`Peer++ evaluation requested by ${corrector.intraLogin} for \`${name}\``);
		await respond(`Peer++ evaluation requested by ${corrector.intraLogin} for \`${name}\`...`);

		const locks = (await Intra.getLocks()).filter((value) => value.projectName == name);
		const lock = getHighestPriorityTeam(locks);
		if (lock === undefined) {
			await respond(`No-one needs to be evaluated on \`${name}\``);
			return;
		}

		await respond(`Found a team to be evaluated, booking evaluation...`);
		await swapScaleTeams(respond, corrector, lock);
	}

	/**
	 * Notifies every evaluator watching the project of a team that now waits for an evaluation.
	 * @param projectID The project the team was locked on, as Intra knows it.
	 */
	export function notifyOfNewLock(projectID: number) {
		const name = Projects.nameOf(projectID);
		if (name === undefined) {
			Logger.log(`Not notifying anyone of the new lock: project ${projectID} is not in the config`, LogType.WARNING);
			return;
		}

		DB.allEvaluatorsFavoriting(projectID, (user) => {
			SlackBot.sendMessage(
				user,
				`A \`${name}\` team is waiting for a Peer++ evaluator to book an evaluation with them.` +
					`\nUse the command \`/book ${name}\` to book it.` +
					`\nUse the command \`/notify-off ${name}\` to stop receiving these notifications.`
			);
		});
	}

	/**
	 * Resolves the projects a user typed after a command against the config.
	 *
	 * Projects are separated by spaces, which works because no project name contains one.
	 * A comma in between is accepted too, so `libft, ft_printf` is not an error.
	 *
	 * @param text The raw text of the command.
	 * @returns The matched projects, deduplicated, and whatever could not be matched.
	 */
	function resolveProjects(text: string): { projects: { name: string; ids: number[] }[]; unknown: string[] } {
		const projects = new Map<string, { name: string; ids: number[] }>();
		const unknown: string[] = [];

		for (const word of text.split(/[\s,]+/)) {
			// What is echoed back has to be cleaned too, or the backticks the user pasted end up
			// pairing with the ones the message adds around it.
			const given = Projects.clean(word);
			if (given === "") continue;

			const project = Projects.find(given);
			project !== undefined ? projects.set(project.name, project) : unknown.push(given);
		}

		return { projects: [...projects.values()], unknown };
	}

	/**
	 * Marks projects as favorite, or removes them, for the evaluator invoking the command.
	 * Only teams waiting for a Peer++ evaluation on a favorited project are notified about.
	 *
	 * Either every given project is applied or none is: an unrecognized project leaves the
	 * favorites untouched, so the user does not have to work out how far the command got.
	 *
	 * @param projectNames The projects given by the user, space separated, validated against the config.
	 * @param favorite Whether to add or remove the favorites.
	 */
	export async function setFavorites(respond: RespondFn, slackUID: string, projectNames: string, favorite: boolean) {
		const command = favorite ? "/notify-on" : "/notify-off";
		const { projects, unknown } = resolveProjects(projectNames);

		if (unknown.length > 0) {
			await respond(
				`Project${unknown.length > 1 ? "s" : ""} ${unknown.map((name) => `\`${name}\``).join(", ")} not recognized, invoke /projects for more info.` +
					`\nNothing was changed, none of your favorites were touched.`
			);
			return;
		}

		if (projects.length === 0) {
			await respond(`Please provide one or more projects, for example \`${command} libft\` or \`${command} libft ft_printf\`.` + `\nInvoke /projects to see them all.`);
			return;
		}

		// A favorite is stored per project id, and one name can stand for several of those.
		const names = projects.map((project) => project.name);
		const ids = projects.flatMap((project) => project.ids);

		// The messages below read the same for one project and for many, so they only
		// need the listing, the verb and the pronoun to agree with the amount given.
		const many = names.length > 1;
		const listed = names.map((name) => `\`${name}\``).join(", ");
		const favorites = many ? "your favorites" : "one of your favorites";
		const them = many ? "them" : "it";

		const user = await getFullUser({ slackUID: slackUID });
		await DB.saveEvaluator(user);

		if (favorite) {
			const added = await DB.addFavorites(user.intraUID, ids);
			await respond(
				added === 0
					? `${listed} ${many ? "were" : "was"} already ${favorites}, nothing changed.`
					: `${listed} ${many ? "are" : "is"} now ${favorites}, you will be notified when a team is waiting for a Peer++ evaluation on ${them}.` +
							`\nUse the command \`/notify-off ${names.join(" ")}\` to stop receiving these notifications.`
			);
			return;
		}

		const removed = await DB.removeFavorites(user.intraUID, ids);
		await respond(
			removed === 0
				? `${listed} ${many ? "were" : "was"} not ${favorites}. Use the command \`/notify-on ${names.join(" ")}\` to add ${them}.`
				: `${listed} ${many ? "are" : "is"} no longer ${favorites}, you will no longer be notified about ${them}.`
		);
	}

	/** Marks every project of the config as favorite, so the evaluator is notified of every team waiting for a Peer++ evaluation. */
	export async function favoriteAll(respond: RespondFn, slackUID: string) {
		// The config can hold several ids under one name, count each name only once but favorite every id.
		const names = Projects.names();
		if (names.length === 0) {
			await respond(`There are no projects to be notified about.`);
			return;
		}

		const user = await getFullUser({ slackUID: slackUID });
		await DB.saveEvaluator(user);
		const added = await DB.addFavorites(
			user.intraUID,
			Config.projects.map((project) => project.id)
		);

		await respond(
			added === 0
				? `All ${names.length} projects already were your favorites, you are notified of every team waiting for a Peer++ evaluation.`
				: `All ${names.length} projects are your favorites now, you will be notified of every team waiting for a Peer++ evaluation.` +
						`\nUse the command \`/notify-off-all\` to stop receiving these notifications.`
		);
	}

	/** Drops every favorite of the evaluator, so they stop being notified of teams waiting for a Peer++ evaluation. */
	export async function clearFavorites(respond: RespondFn, slackUID: string) {
		const user = await getFullUser({ slackUID: slackUID });
		const removed = await DB.clearFavorites(user.intraUID);

		await respond(
			removed === 0
				? `You had no favorites, so you were not being notified about anything.`
				: `Removed all ${removed} of your favorites, you will no longer be notified about any project.` + `\nUse the command \`/notify-on <project>\` to start again.`
		);
	}

	/**
	 * Whether the invoker is a Peer++ evaluator, and which projects they favorited.
	 * Anyone can invoke /projects, including users that cannot be resolved to an Intra
	 * account, so this never throws: it falls back to a plain non-evaluator answer.
	 */
	export async function favoritesOfInvoker(slackUID: string): Promise<{ isEvaluator: boolean; favorites: string[] }> {
		try {
			const user = await getFullUser({ slackUID: slackUID });
			if (!(await Intra.hasGroup(user.intraUID, Config.groupID))) {
				return { isEvaluator: false, favorites: [] };
			}

			// Favorites are stored per project id, the user only ever sees the name behind it.
			const favorites = (await DB.favoritesOf(user.intraUID)).map((projectID) => Projects.nameOf(projectID)).filter((name): name is string => name !== undefined);
			return { isEvaluator: true, favorites: [...new Set(favorites)] };
		} catch (error) {
			Logger.log(`Could not look up the favorites of ${slackUID}: ${error}`, LogType.WARNING);
			return { isEvaluator: false, favorites: [] };
		}
	}
}

/*============================================================================*/

/** Display all the projects available for evaluations. */
SlackBot.registerCommand("/projects", { description: "List the projects the bot locks final evaluations for, with your favorites marked." }, async (respond, body) => {
	const { isEvaluator, favorites } = await SlackBot.favoritesOfInvoker(body.user_id);
	let text = `Possible projects to evaluate:\n`;

	for (const name of Projects.names()) {
		text += `- \`${name}\`${favorites.includes(name) ? " :star:" : ""}\n`;
	}

	if (isEvaluator) {
		text +=
			`\n:star: = your favorites, the projects you are notified about when a team is waiting for a Peer++ evaluation.` +
			`\nUse \`/notify-on <project>\` to add them and \`/notify-off <project>\` to remove them, several at once separated by a space.`;
	}
	await respond(text);
});

/** List all teams waiting for a Peer++ evaluation. */
SlackBot.registerCommand("/evaluations", { description: "Show every team waiting for a Peer++ evaluation, and how long it has been waiting." }, async (respond) => {
	await SlackBot.displayEvaluations(respond);
});

/** List which evaluators are notified of teams waiting for a Peer++ evaluation, per project. */
SlackBot.registerEvaluatorCommand("/evaluators", { description: "Show which evaluators are notified per project, to see where the coverage is." }, async (respond) => {
	await SlackBot.displayEvaluators(respond);
});

/** Book an evaluation for the given project. */
SlackBot.registerEvaluatorCommand(
	"/book",
	{ args: "<project>", description: "Evaluate the team that has been waiting the longest on that project, becoming its corrector." },
	async (respond, body, invoker) => {
		await SlackBot.bookEvaluation(body.text, respond, invoker);
	}
);

/** Mark the given projects as favorite, notify me when a team is waiting for a Peer++ evaluation on them. */
SlackBot.registerEvaluatorCommand(
	"/notify-on",
	{ args: "<project>[, <project>...]", description: "Favorite one or more projects, to be notified when a team is waiting for a Peer++ evaluation on them." },
	async (respond, body) => {
		await SlackBot.setFavorites(respond, body.user_id, body.text, true);
	}
);

/** Remove the given projects from my favorites, stop notifying me of their teams waiting for a Peer++ evaluation. */
SlackBot.registerEvaluatorCommand(
	"/notify-off",
	{ args: "<project>[, <project>...]", description: "Unfavorite one or more projects, to stop being notified about their waiting teams." },
	async (respond, body) => {
		await SlackBot.setFavorites(respond, body.user_id, body.text, false);
	}
);

/** Make every project a favorite, notify me of every team waiting for a Peer++ evaluation. */
SlackBot.registerEvaluatorCommand(
	"/notify-on-all",
	{ description: "Favorite every project at once, to be notified of every team waiting for a Peer++ evaluation." },
	async (respond, body) => {
		await SlackBot.favoriteAll(respond, body.user_id);
	}
);

/** Remove all my favorites, stop notifying me of teams waiting for a Peer++ evaluation. */
SlackBot.registerEvaluatorCommand("/notify-off-all", { description: "Clear all your favorites, to stop being notified about any project." }, async (respond, body) => {
	await SlackBot.clearFavorites(respond, body.user_id);
});

/** List every command of the bot. */
SlackBot.registerCommand("/help", { description: "List every command of the bot and what it is for." }, async (respond) => {
	await SlackBot.displayHelp(respond);
});

/*============================================================================*/

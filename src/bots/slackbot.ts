// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import DB from "../db";
import { Env } from "../env";
import { Config } from "../config";
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
	 * Find the oldest evaluation that has been booked by the bot.
	 * @param locks The reserved evaluations by the bot.
	 * @returns The oldest scaleteam available in the locks.
	 */
	const getHighestPriorityTeam = (locks: Intra.ScaleTeam[]) => {
		let shortestAgo = Date.now();
		let best: Intra.ScaleTeam | null = null;

		for (const scaleTeam of locks) {
			if (scaleTeam.createdAt.getTime() < shortestAgo) {
				shortestAgo = scaleTeam.createdAt.getTime();
				best = scaleTeam;
			}
		}

		return best as Intra.ScaleTeam;
	};

	/**
	 * Merges all the locked evaluation in an aggregate view.
	 * That is for example all libft projects get merged into one row.
	 * @param locks The reserved evaluations by the bot.
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
	 *  This function registers a command and handles exceptions.
	 *  To not use try/catch in the `cb()` function, it will be caught automatically and a message will be logged and sent to the user.
	 */
	export function registerCommand(cmd: string, cb: (respond: RespondFn, body: SlashCommand) => Promise<void> | void) {
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
	 * Registers a command that can only be used by evaluators.
	 * It is slower than the `registerCommand()` because of the extra API call.
	 * Use `registerCommand()` if you don't need to check if the user is an Peer++ evaluator.
	 **/
	export function registerEvaluatorCommand(cmd: string, cb: (respond: RespondFn, body: SlashCommand, invoker: User) => Promise<void> | void) {
		registerCommand(cmd, async (respond, body) => {
			const invoker = await getFullUser({ slackUID: body.user_id });

			if (!(await Intra.hasGroup(invoker.intraUID!, Config.groupID))) {
				await respond("You are not a Peer++ evaluator. Please apply! :doot:");
				return;
			}
			await cb(respond, body, invoker);
		});
	}

	/**
	 * Swaps the lock with a proper evaluation of the corrector.
	 * @param respond The messaging function.
	 * @param corrector The user doing the correction.
	 * @param lock The reserved evaluation by the bot.
	 */
	async function swapScaleTeams(respond: RespondFn, corrector: User, lock: Intra.ScaleTeam) {
		const correcteds: User[] = await Promise.all(lock.correcteds.map((c) => getFullUser(c)));
		if (correcteds.includes(corrector)) {
			await respond("You can't book yourself. Nice try :dongle:");
			return;
		}

		await DB.insert(lock.teamID).catch((reason) => {
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
		Logger.log(`Swapped out lock ${lock.id} for evaluation ${lock.teamName}.`);
	}

	//= Command functions =//

	/**
	 * Display all teams waiting for Peer++ evaluations, aka the ones the bot locked.
	 * @param respond The slack response function, sends a message to user.
	 */
	export async function displayEvaluations(respond: RespondFn) {
		await respond("Please wait, fetching teams waiting for a Peer++ evaluation...");

		let locks: Intra.ScaleTeam[] = await Intra.getBotEvaluations();
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
	 * Book an evaluation by swapping out the scale teams of the bot with the user.
	 * @param projectName The project name.
	 * @param respond The slack messaging function.
	 * @param user The corrector.
	 */
	export async function bookEvaluation(projectName: string, respond: RespondFn, corrector: User) {
		if (!projectName || !Config.projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase())) {
			await respond(`Project \`${projectName}\` not recognized, invoke /projects for more info`);
			return;
		}

		// const canEvaluate = await Intra.validatedProject(corrector.intraUID, projectName); //||
		// await Intra.hasCompletedCore(corrector.intraLogin); // NOTE: For the future person who comes here, no sure if this thing works?
		// if (!canEvaluate) {
		// 	await respond("Sorry, you can't book a project you have not completed :sus:");
		// 	return;
		// }

		Logger.log(`Peer++ evaluation requested by ${corrector.intraLogin} for \`${projectName}\``);
		await respond(`Peer++ evaluation requested by ${corrector.intraLogin} for \`${projectName}\`...`);

		const locks = (await Intra.getBotEvaluations()).filter((value) => value.projectName == projectName);
		if (locks.length == 0) {
			await respond(`No-one needs to be evaluated on \`${projectName}\``);
			return;
		}

		await respond(`Found a team to be evaluated, booking evaluation...`);
		await swapScaleTeams(respond, corrector, getHighestPriorityTeam(locks));
	}

	export function notifyOfNewLock(projectName: string) {
		const project = projectName.toLowerCase();

		DB.allEvaluatorsFavoriting(project, (user) => {
			SlackBot.sendMessage(
				user,
				`A \`${project}\` team is waiting for a Peer++ evaluator to book an evaluation with them.` +
					`\nUse the command \`/book ${project}\` to book it.` +
					`\nUse the command \`/notify-off ${project}\` to stop receiving these notifications.`
			);
		});
	}

	/**
	 * Marks a project as favorite, or removes it, for the evaluator invoking the command.
	 * Only favorited projects are notified about.
	 *
	 * @param projectName The project given by the user, validated against the config.
	 * @param favorite Whether to add or remove the favorite.
	 */
	export async function setFavorite(respond: RespondFn, slackUID: string, projectName: string, favorite: boolean) {
		const command = favorite ? "/notify-on" : "/notify-off";
		const given = projectName.trim();

		if (!given) {
			await respond(`Please provide a project, for example \`${command} libft\`. Invoke /projects to see them all.`);
			return;
		}

		const project = Config.projects.find((p) => p.name.toLowerCase() === given.toLowerCase());
		if (!project) {
			await respond(`Project \`${given}\` not recognized, invoke /projects for more info`);
			return;
		}

		const name = project.name.toLowerCase();
		const user = await getFullUser({ slackUID: slackUID });
		await DB.saveEvaluator(user);

		if (favorite) {
			await DB.addFavorite(user.intraUID, name);
			await respond(
				`\`${name}\` is now one of your favorites, you will be notified when a team is waiting for a Peer++ evaluation on it.` +
					`\nUse the command \`/notify-off ${name}\` to stop receiving these notifications.`
			);
			return;
		}

		const wasFavorite = await DB.removeFavorite(user.intraUID, name);
		await respond(
			wasFavorite
				? `\`${name}\` is no longer one of your favorites, you will no longer be notified about it.`
				: `\`${name}\` was not one of your favorites. Use the command \`/notify-on ${name}\` to add it.`
		);
	}

	/** Marks every project of the config as favorite, so the evaluator is notified about all of them. */
	export async function favoriteAll(respond: RespondFn, slackUID: string) {
		const projects = Config.projects.map((project) => project.name.toLowerCase());
		if (projects.length === 0) {
			await respond(`There are no projects to be notified about.`);
			return;
		}

		const user = await getFullUser({ slackUID: slackUID });
		await DB.saveEvaluator(user);
		const added = await DB.addFavorites(user.intraUID, projects);

		await respond(
			added === 0
				? `All ${projects.length} projects already were your favorites, you are notified about every one of them.`
				: `Added ${added} project(s) to your favorites, you will now be notified about all ${projects.length} of them.` +
						`\nUse the command \`/notify-off-all\` to stop receiving these notifications.`
		);
	}

	/** Drops every favorite of the evaluator, so they stop receiving notifications entirely. */
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
			return { isEvaluator: true, favorites: await DB.favoritesOf(user.intraUID) };
		} catch (error) {
			Logger.log(`Could not look up the favorites of ${slackUID}: ${error}`, LogType.WARNING);
			return { isEvaluator: false, favorites: [] };
		}
	}
}

/*============================================================================*/

/** Display all the projects available for evaluations. */
SlackBot.registerCommand("/projects", async (respond, body) => {
	const { isEvaluator, favorites } = await SlackBot.favoritesOfInvoker(body.user_id);
	let text = `Possible projects to evaluate:\n`;

	for (const project of Config.projects) {
		const isFavorite = favorites.includes(project.name.toLowerCase());
		text += `- \`${project.name}\`${isFavorite ? " :star:" : ""}\n`;
	}

	if (isEvaluator) {
		text += `\n:star: = your favorites, the projects you are notified about.` + `\nUse \`/notify-on <project>\` to add one and \`/notify-off <project>\` to remove one.`;
	}
	await respond(text);
});

/** List all teams waiting for a Peer++ evaluation. */
SlackBot.registerCommand("/evaluations", async (respond) => {
	await SlackBot.displayEvaluations(respond);
});

/** Book an evaluation for the given project. */
SlackBot.registerEvaluatorCommand("/book", async (respond, body, invoker) => {
	await SlackBot.bookEvaluation(body.text, respond, invoker);
});

/** Mark the given project as favorite, notify me when one of its evaluations is locked. */
SlackBot.registerEvaluatorCommand("/notify-on", async (respond, body) => {
	await SlackBot.setFavorite(respond, body.user_id, body.text, true);
});

/** Remove the given project from my favorites, stop notifying me about it. */
SlackBot.registerEvaluatorCommand("/notify-off", async (respond, body) => {
	await SlackBot.setFavorite(respond, body.user_id, body.text, false);
});

/** Make every project a favorite, notify me about all of them. */
SlackBot.registerEvaluatorCommand("/notify-on-all", async (respond, body) => {
	await SlackBot.favoriteAll(respond, body.user_id);
});

/** Remove all my favorites, stop notifying me entirely. */
SlackBot.registerEvaluatorCommand("/notify-off-all", async (respond, body) => {
	await SlackBot.clearFavorites(respond, body.user_id);
});

/*============================================================================*/

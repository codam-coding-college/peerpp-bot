// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import DB from "../db";
import { Env } from "../env";
import { Config } from "../config";
import Intra from "../utils/intra";
import Logger from "../utils/logger";
import prettyMilliseconds from "pretty-ms";
import { App, LogLevel,RespondFn } from "@slack/bolt";
import { ChatPostMessageArguments } from "@slack/web-api";
import { getFullUser, IncompleteUser, User } from "../utils/user";

/*============================================================================*/

export const slackApp = new App({
	token: Env.SLACK_TOKEN,
	appToken: Env.SLACK_APP_TOKEN,
	port: Env.SLACKBOT_PORT || 3000,
	logLevel: LogLevel.ERROR,
	socketMode: true
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
	}

	/**
	 * Merges all the locked evaluation in an aggregate view.
	 * That is for example all libft projects get merged into one row.
	 * @param locks The reserved evaluations by the bot.
	 */
	const aggregateProjects = (locks: Intra.ScaleTeam[]) => {
		const count: {[key: string]: { teamCount: number, createdAt: Date }} = {};

		for (const lock of locks) {
			if (!count[lock.projectName])
				count[lock.projectName] = { teamCount: 0, createdAt: new Date() };
				
			count[lock.projectName]!.teamCount++;

			if (lock.createdAt.getTime() < count[lock.projectName]!.createdAt.getTime())
				count[lock.projectName]!.createdAt = lock.createdAt;
		}
		return count;
	}

	/**
	 * Send a message to a given user with a given message.
	 * @param user The user to which the message is sent.
	 * @param message The message to send.
	 */
	export async function sendMessage(user: User, message: string) {
		const opt: ChatPostMessageArguments = { channel: user.slackUID, text: message };

		const response = await slackApp.client.chat.postMessage(opt);
		if (!response.ok)
			throw new Error(`Failed to send message: ${response.error}`);	
	}

	/**
	 * Swaps the lock with a proper evaluation of the corrector.
	 * @param respond The messaging function.
	 * @param corrector The user doing the correction.
	 * @param lock The reserved evaluation by the bot.
	 */
	async function swapScaleTeams(respond: RespondFn, corrector: User, lock: Intra.ScaleTeam)  {
		await DB.insert(lock.teamID).catch((reason) => { throw new Error(reason) });

		Logger.log(`Deleting lock ${lock.id} for ${lock.teamName} on ${lock.projectName}`);
		const scaleResponse = await Intra.api.delete(`/scale_teams/${lock.id}`, {});
		if (!scaleResponse.ok)
			throw new Error(`Failed to delete lock: ${scaleResponse.statusText}`);

		const evaluationDate = new Date(Date.now() + (15 * 60 * 1000));
		await Intra.bookEvaluation(lock.scaleID, lock.teamID, corrector.intraUID, evaluationDate);

		const correcteds: User[] = await Promise.all(lock.correcteds.map((c) => getFullUser(c)));
		let text = `You will evaluate team \`${lock.teamName}\`, consisting of: `;

		for (const user of correcteds)
			text += `${user.intraLogin} `;
		text += `at ${evaluationDate}, they will be notified on slack. Please contact each other.`;
		await respond(text);

		for (const user of correcteds)
			await SlackBot.sendMessage(user, `You will be evaluated by \`${corrector.intraLogin}\` on your \`${lock.projectName}\`.\nContact them to set a date for the evaluation.\n`);
		Logger.log(`Swapped out lock ${lock.id} for evaluation ${lock.teamName}.`);
	}

	
	//= Command functions =//

	/**
	 * Display all currently available evaluations, aka the ones the bot locked.
	 * @param respond The slack response function, sends a message to user.
	 */
	export async function displayEvaluations(respond: RespondFn) {
		await respond("Please wait, fetching available evaluations...");
		
		let locks: Intra.ScaleTeam[] = await Intra.getBotEvaluations();
		if (locks.length == 0) {
			respond("Currently, no-one needs to be evaluated :feelsbadman:");
			return;
		}

		locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		const projects = aggregateProjects(locks);

		let text: string = "Available evaluations:\n"
		for (const project in projects) {
			const timeLocked = prettyMilliseconds(Date.now() - projects[project]!.createdAt.getTime(),
				{ verbose: true, unitCount: 1 }
			);

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
	export async function bookEvaluation(projectName: string, respond: RespondFn, user: IncompleteUser) {
		if (!projectName || !Config.projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase())) {
			await respond(`Project \`${projectName}\` not recognized, invoke /projects for more info`);
			return;
		}

		const corrector = await getFullUser(user);
		if (!await Intra.hasGroup(corrector.intraUID, Config.groupID)) {
			await respond("Sorry, you're not a Peer++ evalutor. Please apply! :doot:");
			return;
		}
		if (!await Intra.validatedProject(corrector.intraUID, projectName)) {
			await respond("Sorry, you can't book a project you have not completed :sus:");
			return;
		}

		Logger.log(`Peer++ evaluation requested by ${corrector.intraLogin} for \`${projectName}\``);
		await respond(`Peer++ evaluation requested by ${corrector.intraLogin} for \`${projectName}\`...`);

		const locks = (await Intra.getBotEvaluations()).filter(value => value.projectName == projectName);
		if (locks.length == 0) {
			await respond(`No-one needs to be evaluated on \`${projectName}\``);
			return
		}

		await respond(`Found a team to be evaluated, booking evaluation...`);
		await swapScaleTeams(respond, corrector, getHighestPriorityTeam(locks))
	}
}

/*============================================================================*/

/** Display all the projects available for evaluations. */
slackApp.command("/projects", async (ctx) => {
	let text = `Possible projects to evaluate:\n`;

	for (const project of Config.projects)
		text += `- \`${project.name}\`\n`;
	await ctx.ack(text);
});

/** List all available evaluations. */
slackApp.command("/evaluations", async (ctx) => {
	try { await SlackBot.displayEvaluations(ctx.respond); }
	catch (error) { 
		Logger.log(`Failed to display evaluations: ${error}`);
		ctx.respond(`:panic: Sorry the bot failed: ${error}`); 
	}
	await ctx.ack();
});

/** Book an evaluation for the given project.*/
slackApp.command("/book", async (ctx) => {
	try { await SlackBot.bookEvaluation(ctx.body.text, ctx.respond, {slackUID: ctx.body.user_id}); }
	catch (error) { 
		Logger.log(`Failed to book an evaluation: ${error}`);
		ctx.respond(`:panic: Sorry the bot failed: ${error}`);
	}
	await ctx.ack();
});

/*============================================================================*/

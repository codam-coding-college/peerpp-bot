/* ************************************************************************** */
/*                                                                            */
/*                                                        ::::::::            */
/*   slackbot.ts                                        :+:    :+:            */
/*                                                     +:+                    */
/*   By: W2Wizard <w2.wizzard@gmail.com>              +#+                     */
/*                                                   +#+                      */
/*   Created: 2022/10/09 17:14:54 by W2Wizard      #+#    #+#                 */
/*   Updated: 2022/10/09 17:14:54 by W2Wizard      ########   odam.nl         */
/*                                                                            */
/* ************************************************************************** */

import { db } from "./app";
import Logger from "./utils/log";
import { env } from "./utils/env";
import prettyMilliseconds from "pretty-ms";
import { Intra } from "./utils/intra/intra";
import { getFullUser } from "./utils/getUser";
import { App, LogLevel, SayFn } from "@slack/bolt";
import { IncompleteUser, User } from "./utils/types";
import { ChatPostMessageArguments } from "@slack/web-api";

/*============================================================================*/

export const slackApp = new App({
	token: env.SLACK_TOKEN,
	appToken: env.SLACK_APP_TOKEN,
	port: parseInt(process.env["PORT"] || "3000"),
	socketMode: true,
	logLevel: LogLevel.ERROR
});

/*============================================================================*/

/** Utility functions for the slack bot */
namespace slackBot {

	//==// Logic functions //==//

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

		// Merge all the locks together.
		for (const lock of locks) {
			if (!count[lock.projectSlug])
				count[lock.projectSlug] = { teamCount: 0, createdAt: new Date() };
				
			count[lock.projectSlug]!.teamCount++;

			if (lock.createdAt.getTime() < count[lock.projectSlug]!.createdAt.getTime())
				count[lock.projectSlug]!.createdAt = lock.createdAt;
		}
		return count;
	}

	/**
	 * Sends a confirmation message the user who is going to receive the evaluation.
	 * @param corrected The user getting the evaluation.
	 * @param corrector The user doing the evaluation.
	 * @param projectSlug The project which will be corrected.
	 */
	const sendConfirmation = async (corrected: User, corrector: User, projectSlug: string) => {
		const opt: ChatPostMessageArguments = {
			channel: corrected.slackUID,
			text: `You will be evaluated by ${corrector.intraLogin} on your \`${projectSlug}\`\nContact them to set a date for the evaluation`,
		};

		const response = await slackApp.client.chat.postMessage(opt);
		if (!response.ok)
			throw new Error(`Failed to send message: ${response.error}`);
	}

	/**
	 * Swaps the lock with a proper evaluation of the corrector.
	 * @param say The messaging function.
	 * @param corrector The user doing the correction.
	 * @param lock The reserved evaluation by the bot.
	 */
	const swapScaleTeams = async (say: SayFn, corrector: User, lock: Intra.ScaleTeam) => {
		await Intra.api.delete(`/scale_teams/${lock.id}`).catch(async (reason) => {
			say("Failed to book the evaluation. Please inform staff!");
			return await Logger.err(`Failed to delete lock for scaleTeam: ${lock.id} : ${reason}`);
		});

		const startEval = new Date(Date.now() + 20 * 60 * 1000); // TODO: Can we do exactly 15 Minutes?
		if (!await Intra.bookEval(lock.scaleID, lock.teamID, corrector.intraUID, startEval)) {
			say("Failed to book the evaluation. Please inform staff!");
			return await Logger.err(`Failed to book evaluation for scaleTeam: ${lock.id}`);
		}

		try {
			db.run(`INSERT INTO expiredLocks(scaleteamID) VALUES(${lock.id})`, (err) => {
				if (err != null) 
					throw new Error(`DB failed to insert scaleteamid ${lock.id} to expiredLocks : ${err.message}`);
			});
		} catch (error) {
			Logger.err(error);
			say("Failed to book the evaluation. Please inform staff!");
		}

		let text = `You will evaluate team \`${lock.teamName}\`, consisting of: `;
		const correcteds: User[] = await Promise.all(lock.correcteds.map((c) => getFullUser(c)));
		for (const user of correcteds) 
			text += `@${user.intraLogin} `;
		text += `at ${startEval}, they will be sent a message on Slack letting them know you've booked an eval, and asking them to contact you`;
		say(text);
	
		for (const user of correcteds)
			await sendConfirmation(user, corrector, lock.projectSlug);
		await Logger.log(`Swapped out lock for evaluation: ID: ${lock.id} Team: ${lock.teamName}`);
	}

	//==// Display functions //==//

	/**
	 * Displays the help text for all the available commands.
	 * @note Temporary as these will later be replaced with commands.
	 * @param say The messaging function.
	 */
	export const displayHelp = async (say: SayFn) => {
		const text = `\`\`\`
		help                           Show this help.
		list-projects                  List all projects which a peer++ evaluator can evaluate.
		list-evaluations               List all evaluations that were locked by the peer++ bot.
		book-evaluation <PROJECT_SLUG> Book an evaluation for a project.
		\`\`\``;
	
		say(text);
	}

	/**
	 * Displays the available projects to be evaluated by the bot.
	 * @param say The messaging function.
	 */
	export const displayProjects = async (say: SayFn) => {
		let text = `Possible projects to evaluate:\n`;

		for (const project of env.projects)
			text += `- \`${project.slug}\`\n`;
		say(text);
	}

	/**
	 * Displays all currently available projects to 
	 * @param say The messaging function.
	 */
	export const displayEvaluations = async (say: SayFn) => {
		say("Please wait, fetching available evaluations...");

		let locks: Intra.ScaleTeam[] = [];
		try { 
			locks = await Intra.getEvaluationLocks(); 
			if (locks.length == 0) {
				say("Currently, no-one needs to be evaluated.")
				return;
			}
			locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		}
		catch (error) {
			await Logger.err(`Failed to fetch evaluation locks: ${error}`);
			say(`Sorry, something went wrong: ${error}`)
			return;
		}

		// Display all projects in aggregate form.
		const projects = aggregateProjects(locks);
		
		let text: string = "Available evaluations, highest priorty first:\n"
		for (const project in projects) {
			const timeLocked = prettyMilliseconds(Date.now() - projects[project]!.createdAt.getTime(),
				{ verbose: true, unitCount: 1 }
			);

			text += `\`${project} | ${projects[project]!.teamCount} teams | ${timeLocked} locked\n\``;
		}

		say(text);
	}

	/**
	 * Books an evaluation for the given slack user.
	 * @param text The user message.
	 * @param say The messaging function.
	 * @param corrector The user who wants to book the evaluation.
	 */
	export const bookEvaluation = async (text: string, say: SayFn, user: IncompleteUser) => {
		const [_, slug] = text.split(" ");

		if (!slug) return displayProjects(say);
		if (!env.projects.find((p) => p.slug === slug)) {
			say(`Project \`${slug}\` not recognized, see help for more info`);
			return;
		}

		let corrector: User;
		try { corrector = await getFullUser(user); } 
		catch (error) {
			say("Could not match your Slack ID to a Intra user");
			return await Logger.err(error);
		}
		say(`Requested peer++ eval by ${corrector.intraLogin} for \`${slug}\`...`);

		// Swap the scaleteams

		let locks: Intra.ScaleTeam[] = [];
		try { locks = (await Intra.getEvaluationLocks()).filter((lock: Intra.ScaleTeam) =>  lock.projectSlug === slug); } 
		catch (error) {
			say("Failed to fetch evaluation locks. Please inform staff!");
			return await Logger.err(error);
		}
		if (locks.length == 0) {
			say(`No-one needs to be evaluated on \`${slug}\``);
			return;
		}

		say(`Found a team to be evaluated, booking evaluation...`);
		await swapScaleTeams(say, corrector, getHighestPriorityTeam(locks))
	}
}

/*============================================================================*/

// TODO: Implement slash commands
// slackApp.command("/listprojects", async ({ say }) => {
// 	await say("You got me!");
// });

/** Listen to any slack message. */
slackApp.message(/.*/i, async ({ message, say }) => {
	/** @see https://bit.ly/3s0q0ip */
	if (message.channel[0] !== "D")
		return;
	
	//@ts-ignore
	const slackUID: string = message.user;
	//@ts-ignore
	const text: string = message.text;

	if (text.match(/^help/))
		await slackBot.displayHelp(say);
	else if (text.match(/^list-projects/))
		await slackBot.displayProjects(say);
	else if (text.match(/^list-evaluations/))
		await slackBot.displayEvaluations(say);
	else if (text.match(/^book-evaluation/))
		await slackBot.bookEvaluation(text, say, {slackUID: slackUID});
	await say(`Command \`${text}\` not recognized, see help for more info`);
});

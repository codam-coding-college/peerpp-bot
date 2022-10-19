/* ************************************************************************** */
import { db } from "./app";
import Logger from "./utils/log";
import { env } from "./utils/env";
import prettyMilliseconds from "pretty-ms";
import { Intra } from "./utils/intra/intra";
import { getFullUser } from "./utils/getUser";
import { App, LogLevel,RespondFn } from "@slack/bolt";
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
namespace SlackBot {

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
	 * @param res The messaging function.
	 * @param corrector The user doing the correction.
	 * @param lock The reserved evaluation by the bot.
	 */
	const swapScaleTeams = async (res: RespondFn, corrector: User, lock: Intra.ScaleTeam) => {
		try {
			db.run(`INSERT INTO expiredTeam(teamID, scaleteamID) VALUES(${lock.teamID}, ${lock.id})`, (err) => {
				if (err != null) 
					throw new Error(`DB failed to insert scaleteamid ${lock.id} to expiredLocks : ${err.message}`);
			});
		} catch (error) {
			Logger.err(error);
			res("Failed to book the evaluation. Please inform staff!");
		}

		Logger.log(`Deleting ScaleTeam: ${lock.id}`);
		await Intra.api.delete(`/scale_teams/${lock.id}`, {}).catch(async (reason) => {
			res("Failed to book the evaluation. Please inform staff!");
			return await Logger.err(`Failed to delete lock for scaleTeam: ${lock.id} : ${reason}`);
		});

		// TODO: Delete the leftover slot, check if that is necessary.

		// Instantly start the evaluation as to not let them cancel it.
		const startEval = new Date(Date.now() + 15 * 60 * 1000);
		if (!await Intra.bookEval(lock.scaleID, lock.teamID, corrector.intraUID, startEval)) {
			res("Failed to book the evaluation. Please inform staff!");
			return await Logger.err(`Failed to book evaluation for scaleTeam: ${lock.id}`);
		}

		let text = `You will evaluate team \`${lock.teamName}\`, consisting of: `;
		const correcteds: User[] = await Promise.all(lock.correcteds.map((c) => getFullUser(c)));
		for (const user of correcteds) 
			text += `${user.intraLogin} `;
		text += `at ${startEval}, they will be sent a message on Slack letting them know you've booked an eval, and asking them to contact you`;
		res(text);
	
		for (const user of correcteds)
			await sendConfirmation(user, corrector, lock.projectSlug);
		await Logger.log(`Swapped out lock for evaluation: ID: ${lock.id} Team: ${lock.teamName}`);
	}

	//==// Display functions //==//

	/**
	 * Displays all currently available projects to 
	 * @param res The messaging function.
	 */
	export const displayEvaluations = async (res: RespondFn) => {
		res("Please wait, fetching available evaluations...");

		let locks: Intra.ScaleTeam[] = [];
		try { 
			locks = await Intra.getEvaluationLocks(); 
			if (locks.length == 0) {
				res("Currently, no-one needs to be evaluated.")
				return;
			}
			locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		}
		catch (error) {
			await Logger.err(`Failed to fetch evaluation locks: ${error}`);
			res(`Sorry, something went wrong: ${error}`)
			return;
		}

		const projects = aggregateProjects(locks);
		
		let text: string = "Available evaluations, highest priorty first:\n"
		for (const project in projects) {
			const timeLocked = prettyMilliseconds(Date.now() - projects[project]!.createdAt.getTime(),
				{ verbose: true, unitCount: 1 }
			);

			text += `\`${project} | ${projects[project]!.teamCount} teams | ${timeLocked} locked\`\n`;
		}

		res(text);
	}

	/**
	 * Books an evaluation for the given slack user.
	 * @param text The user message.
	 * @param say The messaging function.
	 * @param corrector The user who wants to book the evaluation.
	 */
	export const bookEvaluation = async (text: string, res: RespondFn, user: IncompleteUser) => {
		const [_, slug] = text.split(" ");

		if (!slug) {
            res("Project not found. Use /projects to find all available projects.");
            return;
        }
		if (!env.projects.find((p) => p.slug === slug)) {
			res(`Project \`${slug}\` not recognized, see help for more info`);
			return;
		}

		let corrector: User;
		try { corrector = await getFullUser(user); } 
		catch (error) {
			res("Could not match your Slack ID to a Intra user");
			return await Logger.err(error);
		}

		// Is user in the peer++ group or that they did the project.
		try {
			if (!await Intra.hasGroup(corrector, env.PEERPP_GROUP_ID)) {
				res("Sorry, you're not a Peer++ evalutor. Please apply! :panic:");
				return;
			}
			if (!await Intra.didProject(corrector, slug)) {
				res("Sorry, you have to yet make this project :sus:");
				return;
			}
		} catch (error) {
			Logger.err(error);
			res("Sorry, something went very wrong. Please inform staff! :panic:");
			return;
		}

        Logger.log(`Eval booked: ${corrector.intraLogin} for ${slug}`);
		res(`Requested peer++ eval by ${corrector.intraLogin} for \`${slug}\`...`);

		// Swap the scaleteams
		let locks: Intra.ScaleTeam[] = [];
		try { locks = (await Intra.getEvaluationLocks()).filter((lock: Intra.ScaleTeam) =>  lock.projectSlug === slug); } 
		catch (error) {
			res("Failed to fetch evaluation locks. Please inform staff! :panic:");
			return await Logger.err(error);
		}
		if (locks.length == 0) {
			res(`No-one needs to be evaluated on \`${slug}\``);
			return;
		}

		res(`Found a team to be evaluated, booking evaluation...`);
		await swapScaleTeams(res, corrector, getHighestPriorityTeam(locks))
	}
}

/*============================================================================*/

/** Display all the projects available for evaluations. */
slackApp.command("/projects", async (ctx) => {
    let text = `Possible projects to evaluate:\n`;

    for (const project of env.projects)
        text += `- \`${project.slug}\`\n`;
    await ctx.ack(text);
});

/** List all available evaluations. */
slackApp.command("/evaluations", async (ctx) => {
    await SlackBot.displayEvaluations(ctx.respond);
    ctx.ack();
});

/** Book an evaluation for the given project.*/
slackApp.command("/book", async (ctx) => {
    await SlackBot.bookEvaluation(ctx.body.text, ctx.respond, {slackUID: ctx.body.user_id});
    ctx.ack();
});

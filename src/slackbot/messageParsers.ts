import { env } from "../utils/env";
import { SayFn } from "@slack/bolt";
import prettyMilliseconds from "pretty-ms";
import { Intra } from "../utils/intra/intra";
import { ChatPostMessageArguments } from "@slack/web-api";
import Logger from "../utils/log";
import { User } from "../utils/types";
import { getFullUser } from "../utils/getUser";
import { slackApp } from "./slack";
import { db } from "../app";

/* ************************************************************************** */

export async function help(say: SayFn) {
	const text = `\`\`\`
help                                              Show this help
list-projects                                     List all projects which a peer++ evaluator can evaluate
list-evaluations                                  List all evaluations that were locked by the peer++ bot
book-evaluation [PROJECT_SLUG] [CORRECTOR_LOGIN]  Book an evaluation for a project
                                                  [PROJECT_SLUG]:    (optional) the project slug of the project you want to evaluate
                                                  [CORRECTOR_LOGIN]: (optional, restricted) book an evaluation for someone else
\`\`\``;
	await say(text);
}

/* ************************************************************************** */

/**
 * Prints out all the projects that the bot overlooks.
 * @param say The slack say function.
 */
export async function listProjectIds(say: SayFn) {
	let text = `Possible projects to evaluate:\n`;
	
	for (const project of env.projects)
		text += `- \`${project.slug}\`\n`;
	await say(text);
}

/**
 * Find the oldest evaluation that has been booked by the bot.
 * @param scaleTeams The evaluations
 * @returns 
 */
export function highestPriorityScaleTeam(scaleTeams: Intra.ScaleTeam[]): Intra.ScaleTeam {
	let shortestAgo = Date.now();
	let best: Intra.ScaleTeam | null = null;

	for (const scaleTeam of scaleTeams) {
		if (scaleTeam.createdAt.getTime() < shortestAgo) {
			shortestAgo = scaleTeam.createdAt.getTime();
			best = scaleTeam;
		}
	}

	// TODO: Unsafe: We need to actually check that scale teams is not null.
	return best as Intra.ScaleTeam; 
}

function countProjects(locks: Intra.ScaleTeam[]) {
	const count: { [key: string]: { teamsN: number; createdAt: Date } } = {};

	for (const lock of locks) {
		if (!count[lock.projectSlug])
			count[lock.projectSlug] = { teamsN: 0, createdAt: new Date() };
		
			count[lock.projectSlug]!.teamsN++;

		if (lock.createdAt.getTime() < count[lock.projectSlug]!.createdAt.getTime())
			count[lock.projectSlug]!.createdAt = lock.createdAt;
	}
	return count;
}

/**
 * List all current available evaluations that have been booked by the bot.
 * @param say The slack messaging function.
 */
export async function listEvaluations(say: SayFn) {
	await say("Getting evaluation locks, this can take more than 10 seconds...");

	const locks = await Intra.getEvaluationLocks();
	if (locks.length == 0) {
		await say("No-one needs to be evaluated");
		return;
	}

	// Sort on creation date
	locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	const longestName: number = Math.max(...locks.map((lock: Intra.ScaleTeam) => lock.projectSlug.length));

	let text = "Peer++ evaluations, highest priority first\n";
	text += "Format: <project_name> <number_of_evaluations> <time_since_lock>\n";
	text += "```\n";

	const count = countProjects(locks);
	for (const key in count) {
		const name = key.padEnd(longestName, " ");
		const nUsers = count[key]!.teamsN;
		const timeLocked = prettyMilliseconds(Date.now() - count[key]!.createdAt.getTime(),
			{ verbose: true, unitCount: 1 }
		);

		text += `${name} | ${nUsers} teams waiting, ${timeLocked} locked\n`;
	}
	text += "```";
	await say(text);
}

async function sendYouWillBeEvaluatedMsg(corrected: User, corrector: User, projectSlug: string) {
	const opt: ChatPostMessageArguments = {
		channel: corrected.slackUID,
		text: `You will be evaluated by ${corrector.intraLogin} on your \`${projectSlug}\`\nContact them to set a date for the evaluation`,
	};

	const response = await slackApp.client.chat.postMessage(opt);
	if (!response.ok) throw new Error(`Failed to send message: ${response.error}`);
}

/* ************************************************************************** */

/**
 * Finds the oldest locked evaluation and replaces it with a user one.
 * @param say The slack messaging function.
 * @param corrector The user that is going to correct the team.
 * @param projectSlug The project to evaluate.
 */
export async function bookEvaluation(say: SayFn, corrector: User, projectSlug: string) {
	await say(`Requested peer++ eval by ${corrector.intraLogin} for \`${projectSlug}\`...`);

	// Find booked evaluations of the given project
	let locks: Intra.ScaleTeam[] = [];
	try { locks = (await Intra.getEvaluationLocks()).filter((lock: Intra.ScaleTeam) =>  lock.projectSlug === projectSlug); } 
	catch (error) {
		Logger.err(error);
		await say("Oopsie! The bot messed up here, tried to fetch locks, please inform staff!");
		return;
	}
	if (locks.length == 0) {
		await say(`No-one needs to be evaluated on \`${projectSlug}\``);
		return;
	}
	
	const lock: Intra.ScaleTeam = highestPriorityScaleTeam(locks);
	await say(`Found a team to be evaluated, booking evaluation...`);

	// NOTE: Intra requires a eval to be minimum of 15 minutes in the future
	const startEval = new Date(Date.now() + 20 * 60 * 1000);
	await Intra.bookEval(lock.scaleID, lock.teamID, corrector.intraUID, startEval);
	await Logger.log(`Booked evaluation corrector: ${corrector.intraLogin}, correcteds ${lock.correcteds[0]?.intraLogin} on ${projectSlug}`);

	try {
		db.run(`INSERT INTO expiredLocks(scaleteamID) VALUES(${lock.id})`, (err) => {
			if (err != null) throw new Error(`DB failed to insert scaleteamid ${lock.id} to expiredLocks : ${err.message}`);
		});
	} catch (error) {
		Logger.err(error);
		await say("Oopsie! The bot messed up here, tried to insert lock into db, please inform staff!")
	}

	await Intra.api.delete(`/scale_teams/${lock.id}`).catch(async (reason) => {
		Logger.err(`Failed to delete lock: ${reason}`);
		await say("Oopsie! The bot messed up here, tried to delete lock, please inform staff!")
	});

	await Logger.log(`Deleted evaluation lock ${JSON.stringify(lock)}`);

	let text = `You will evaluate team \`${lock.teamName}\`, consisting of: `;
	const correcteds: User[] = await Promise.all(
		lock.correcteds.map((c) => getFullUser(c))
	);

	for (const user of correcteds) 
		text += `@${user.intraLogin} `;
	text += `at ${startEval}`; // TODO: timezone?
	text += `, they will be sent a message on Slack letting them know you've booked an eval, and asking them to contact you`;
	await say(text);

	for (const user of correcteds)
		await sendYouWillBeEvaluatedMsg(user, corrector, lock.projectSlug);
}

import { env } from "../utils/env";
import { User } from "../utils/types";
import * as onMessage from "./messageParsers";
import { getFullUser } from "../utils/getUser";
import { App, LogLevel, SayFn } from "@slack/bolt";
import Logger from "../utils/log";

// App
/* ************************************************************************** */

export const slackApp = new App({
	token: env.SLACK_TOKEN,
	appToken: env.SLACK_APP_TOKEN,
	port: parseInt(process.env["PORT"] || "3000"),
	socketMode: true,
	logLevel: LogLevel.ERROR
});

// Bot utils
/* ************************************************************************** */

/**
 * Check that the given user is a staff member of the watched campus.
 * @param user The user to check.
 * @returns True if the user is an admin else false.
 */
function isPeerPPAdmin(user: User): boolean {
	return env.WATCHED_CAMPUSES.includes(user.campusID) && user.staff;
}

/**
 * Books an evaluation for the given user.
 * @param text The text message send by the user.
 * @param say The 'say' function to post messages to user.
 * @param slackUID The corrector requesting an evaluation.
 */
async function bookEvaluation(text: string, say: SayFn, slackUID: any) {
	const [_, slug, correctorLogin] = text.split(" ");

	if (!slug)
		return await onMessage.listProjectIds(say);
	if (!env.projects.find((p) => p.slug === slug)) {
		await say(`Project \`${slug}\` not recognized, see help for more info`);
		return;
	}

	let corrector: User;
	try { corrector = await getFullUser({ slackUID: slackUID }); } 
	catch (err) {
		Logger.log(err);
		await say(`Could not match your Slack ID to a Intra user`);
		return;
	}

	if (correctorLogin?.length && !isPeerPPAdmin(corrector)) {
		await say(`You're not staff, you can't book an evaluation for someone else`);
		return;
	}
	if (correctorLogin) {
		try { corrector = await getFullUser({ intraLogin: correctorLogin }); } 
		catch (err) {
			await say(`Could not find user ${correctorLogin}`);
			return;
		}
	}
	await onMessage.bookEvaluation(say, corrector, slug!);
}

// Bot Middleware
/* ************************************************************************** */

// TODO: Implement slash commands
// slackApp.command("/listprojects", async ({ say }) => {
// 	await say("You got me!");
// })

// NOTE: So the slack API here is absolute garbage including the Docs ...
// They say there is a "text" field under message but in the Typescript definitons
// this is NOWHERE to be found...
slackApp.message(/.*/i, async ({ message, say}) => {
	// If not direct message, 
	if (message.channel[0] !== "D")
		return;

	//@ts-ignore
	if (!message.text) return;
	//@ts-ignore
	const text = message.text.trim().toLowerCase();
	//@ts-ignore
	const slackUID = message!.user;

	if (text.match(/^help/))
		await onMessage.help(say);
	else if (text.match(/^list-projects/))
		await onMessage.listProjectIds(say);
	else if (text.match(/^list-evaluations/))
		await onMessage.listEvaluations(say);
	else if (text.match(/^book-evaluation/))
		await bookEvaluation(text, say, slackUID);
	await say(`Command \`${text}\` not recognized, see help for more info`);
});

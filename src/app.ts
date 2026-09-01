// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import DB from "./db";
import util from "util";
import { Env } from "./env";
import { CronJob } from "cron";
import { Config } from "./config";
import Intra from "./utils/intra";
import Fast42 from "@codam/fast42";
import { Database } from "sqlite3";
import { slackApp, SlackBot } from "./bots/slackbot";
import { webhookApp } from "./bots/webhook";
import Logger, { LogType } from "./utils/logger";
import { IntraResponse } from "./utils/types";
import Raven from "raven";

/*============================================================================*/

/** Removes the Peer++ locks that have expired, or whose team already finished the project. */
async function checkExpiredLocks() {
	Logger.log("Checking for expired locks ...");

	let locks: Intra.ScaleTeam[] = [];
	try {
		locks = await Intra.getLocks();
	} catch (error) {
		Raven.captureException(error);
		return Logger.log(`${error}`, LogType.ERROR);
	}

	Logger.log(`Current amount of locks: ${locks.length}`);
	if (locks.length == 0) return Logger.log("No locks to delete");

	let n: number = 0;
	for (const lock of locks) {
		// NOTE: setDate() mutates createdAt, so keep a copy of when the lock was actually placed.
		const lockedAt = new Date(lock.createdAt);
		const unlockDate = new Date(lock.createdAt.setDate(lock.createdAt.getDate() + Config.lockExpirationDays));
		// Remove the lock too when the team already finished the project.
		let teamU: IntraResponse.TeamUser[] = await Intra.getTeamUsers(lock.teamID);
		Logger.log(`Team: ${JSON.stringify(teamU)}`);
		let projectState: string | undefined = teamU[0]?.team.status;
		Logger.log(`Project state: ${projectState}`);
		const expired = Date.now() >= unlockDate.getTime();
		if (expired || projectState == "finished") {
			Logger.log(`Deleting expired lock on ${lock.teamName} for project ${lock.projectName}`);

			try {
				await DB.markTeamHandled(lock.teamID);
				await Intra.deleteEvaluation(lock);
				Logger.log(`Deleted ScaleTeam: ${lock.id}`);
				await SlackBot.notifyStaffOfDeletedLock(
					lock,
					lockedAt,
					expired ? "the lock expired" : "the project was already finished",
					teamU.map((teamUser) => teamUser.user.login)
				);
			} catch (error) {
				Raven.captureException(error);
				return Logger.log(`${error}`, LogType.ERROR);
			}
			n++;
		}
	}
	Logger.log(`Deleted: ${n} locks`);
}

/** Deletes the handled-team records that are more than a week old. */
async function deleteOldHandledTeams() {
	Logger.log("Deleting the old handled teams from the database...");

	await DB.deleteOldHandledTeams().catch((reason) => {
		Raven.captureException(reason);
		Logger.log(`Failed to delete the old handled teams: ${reason}`, LogType.WARNING);
	});
}

/*============================================================================*/

util.inspect.defaultOptions.depth = null;
const expirationJob = new CronJob("*/15 * * * *", checkExpiredLocks);
const emptyExpiredJob = new CronJob("0 0 * * 0", deleteOldHandledTeams);
export const db = new Database(Config.dbPath, (err) => {
	if (err !== null) {
		Raven.captureException(err);
		Logger.log(`Failed to create / open Database: ${err}`, LogType.ERROR);
		process.exit(1);
	}
});

/*============================================================================*/

/** Application entry point. */
(async () => {
	Logger.setPath(Config.logOutput);
	Logger.log("Starting Peer++ bot 🤖");
	if (Env.SENTRY_SECRET) Raven.config(`https://${Env.SENTRY_SECRET}@sentry.codam.nl/${Config.sentryID}`).install();

	Intra.api = await new Fast42([
		{
			client_id: Env.INTRA_UID,
			client_secret: Env.INTRA_SECRET,
		},
	])
		.init()
		.catch((reason) => {
			Raven.captureException(reason);
			Logger.log(`Failed to connect: ${reason}`, LogType.ERROR);
			process.exit(1);
		});
	Logger.log("Connected to Intra V2");

	checkExpiredLocks();
	deleteOldHandledTeams();
	expirationJob.start();
	emptyExpiredJob.start();

	await slackApp.start();
	await webhookApp.listen(Env.WEBHOOK_PORT);
})();

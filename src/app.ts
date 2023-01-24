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
import { slackApp } from "./bots/slackbot";
import { webhookApp } from "./bots/webhook";
import Logger, { LogType } from "./utils/logger";

/*============================================================================*/

/** Check which currently booked evaluations are expired. */
async function checkExpiredLocks() {
	Logger.log("Checking for expired locks ...");

	let locks: Intra.ScaleTeam[] = [];
	try { locks = await Intra.getBotEvaluations(); }
	catch (error) {
		return Logger.log(`${error}`, LogType.ERROR);
	}

	Logger.log(`Current amount of locks: ${locks.length}`);
	if (locks.length == 0)
		return Logger.log("No locks to delete");

	let n: number = 0;
	for (const lock of locks) {
		const unlockDate = new Date(lock.createdAt.setDate(lock.createdAt.getDate() + Config.lockExpirationDays));

		if (Date.now() >= unlockDate.getTime()) {
			Logger.log(`Deleting expired lock on ${lock.teamName} for project ${lock.projectName}`);

			try {
				await DB.insert(lock.teamID);
				await Intra.deleteEvaluation(lock);
				Logger.log(`Deleted ScaleTeam: ${lock.id}`);
			} catch (error) {
				return Logger.log(`${error}`, LogType.ERROR);
			}
			n++;
		}
	}
	Logger.log(`Deleted: ${n} locks`);
}

/** Check which expired evaluations are more than a week old. */
async function deleteExpiredLocks() {
	Logger.log("Deleting expired locks from database...");

	await DB.emptyOldLocks().catch((reason) => {
		Logger.log(`Failed to delete expired locks: ${reason}`, LogType.WARNING);
	});
}

/*============================================================================*/

util.inspect.defaultOptions.depth = null;
const expirationJob = new CronJob("*/15 * * * *", checkExpiredLocks);
const emptyExpiredJob = new CronJob("0 0 * * 0", deleteExpiredLocks);
export const db = new Database(Config.dbPath, (err) => {
	if (err !== null) {
		Logger.log(`Failed to create / open Database: ${err}`, LogType.ERROR);
		process.exit(1);
	}
});

/*============================================================================*/

/** Application entry point. */
(async () => {
	Logger.setPath(Config.logOutput);
	Logger.log("Starting Peer++ bot 🤖");

	Intra.api = await new Fast42([{
		client_id: Env.INTRA_UID,
		client_secret: Env.INTRA_SECRET
	}]).init().catch((reason) => {
		Logger.log(`Failed to connect: ${reason}`, LogType.ERROR);
		process.exit(1);
	});
	Logger.log("Connected to Intra V2");

	checkExpiredLocks();
	deleteExpiredLocks();
	expirationJob.start();
	emptyExpiredJob.start();

	await slackApp.start();
	await webhookApp.listen(Env.WEBHOOK_PORT);
})();

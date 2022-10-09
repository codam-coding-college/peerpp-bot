import util from "util";
import { CronJob } from 'cron';
import Logger from "./utils/log";
import { env } from "./utils/env";
import Fast42 from "@codam/fast42";
import { Database } from 'sqlite3';
import { Intra } from "./utils/intra/intra";
import { slackApp } from "./slackbot/slack";
import { webhookApp } from "./webhook/webhook";

// TODO: Go over the entire application and review error messages.

/* ************************************************************************** */

// Set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

// Database for the bot, also hi pde-bakk!
export const db = new Database('peerdb.sqlite');

/* ************************************************************************** */

/**
 * Delete scale teams that are older than a week.
 */
async function checkLocks() {
	Logger.log("Checking for expired locks ...");

	let locks: Intra.ScaleTeam[] = [] 
	try { locks = await Intra.getEvaluationLocks();	} 
	catch (error) { return Logger.err(`${error}`) }

	Logger.log(`Current num of locks: ${locks.length}`);
	if (locks.length == 0) {
		Logger.log("No locks to delete")
		return;
	}

	// Find expired locks
	let n: number = 0;
	for (const lock of locks) {
		const unlockDate = new Date(lock.createdAt.setDate(lock.createdAt.getDate() + env.expireDays));

		// Is the lock expired ?
		if (Date.now() >= unlockDate.getTime()) {
			Logger.log(`Deleting expired lock: ScaleTeamID: ${lock.id} Project: ${lock.projectSlug} Team: ${lock.teamName}`);
			
			db.run(`INSERT INTO expiredLocks(scaleteamID) VALUES(${lock.id})`, (err) => {
				if (err != null)
					Logger.err(`DB failed to insert scaleteamid ${lock.id} to expiredLocks : ${err.message}`);
			});

			await Intra.api.delete(`/scale_teams/${lock.id}`).catch((error) => {
				return Logger.err(`Failed to delete lock: ${error}`)
			});

			// Intra.clearAllSlots().catch((error) => {
			// 	return Logger.err(`${error}`)
			// });
			n++;
		}
	}

	Logger.log(`Deleted: ${n} locks`);
}

/* ************************************************************************** */

// Check for our reserved locks if any of them are expired. TODO: Figure out the frequency of this.
const lockJob = new CronJob("*/15 * * * *", checkLocks);

// db.run(`INSERT INTO expiredLocks(scaleteamID, created_at) VALUES(123, datetime('now', '-${env.expireDays} days'))`);
// Query the database for week old locks, and remove them. 0 0 * * 0
const clearJob = new CronJob("0 0 * * 0", () => {
	Logger.log("Deleting expired locks from database");
	db.run(`DELETE FROM expiredLocks WHERE datetime(created_at) < datetime('now', '-${env.expireDays} days')`, (err) => {
		if (err != null) Logger.err(`Failed to delete old locks: ${err.message}`);
	});
});

/* ************************************************************************** */

(async () => {
	Logger.log("Launching Peer++");
	
    Intra.api = await new Fast42([{
        client_id: env.INTRA_UID,
        client_secret: env.INTRA_SECRET
    }]).init().catch((reason) => {
		Logger.err(`Failed to connect: ${reason}`)
		process.exit(1);
	});

	Logger.log("Connected to Intra V2");

	checkLocks();
	lockJob.start();
	clearJob.start();

    await webhookApp.listen(8080);
	await slackApp.start().catch((error) => {
        Logger.err(`Slack bot failed to start: ${error}`);
        return;
    });
})();

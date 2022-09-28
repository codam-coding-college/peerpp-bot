import util from "util";
import Logger from "./utils/log";
import { env } from "./utils/env";
import Fast42 from "@codam/fast42";
import { Intra } from "./utils/intra/intra";
import { app as webhookApp } from "./webhook/webhook";
import { slackApp } from "./slackbot/slack";
import { CronJob } from 'cron';
import { IntraResponse } from "./utils/types";

/* ************************************************************************** */

// Set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

/* ************************************************************************** */

/**
 * Delete scale teams that are older than a week.
 */
async function checkLocks() {

	Logger.log("Checking for expired locks ...");

	let locks: Intra.ScaleTeam[] = [] 
	try { locks = await Intra.getEvaluationLocks();	} 
	catch (error) {
		Logger.err(`Failed to fetch locks: ${error}`)
	}
	if (locks.length == 0)
		return;

	for (const lock of locks) {
		const unlockDate = new Date(lock.createdAt.setDate(lock.createdAt.getDate() + 7));

		if (Date.now() >= unlockDate.getTime()) {
			await Intra.api.delete(`/scale_teams/${lock.id}`)
			.catch((error) => {
				Logger.err(`Failed to delete lock: ${error}`)
				return;	
			});
			
			// TODO: Add this deleted team to a database so that we can keep track of which once to NOT lock again!
			Logger.log(`Lock has expired. Deleting lock. ID: ${lock.id} Project: ${lock.projectSlug} Team: ${lock.teamName}`);
		}
		else Logger.log(`Lock has not yet expired -> ${lock.id}: ${lock.projectSlug}:${lock.projectID} for ${lock.teamName}:${lock.teamID}`);
	}
}

/* ************************************************************************** */

// Check for our reserved locks if any of them are older than a week.
const cronJob = new CronJob("*/15 * * * *", checkLocks);

(async () => {
	Logger.log("Launching Peer++");
    
    Intra.api = await new Fast42([{
        client_id: env.INTRA_UID,
        client_secret: env.INTRA_SECRET
    }]).init();
	
	Logger.log("Connected to Intra V2");
	cronJob.start();
	checkLocks();

    await webhookApp.listen(8080);
	await slackApp.start().catch((error) => {
        Logger.err(`Slack bot failed to start: ${error}`);
        return;
    });

    Logger.log("Running ...");
})();

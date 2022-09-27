import util from "util";
import Logger from "./utils/log";
import { env } from "./utils/env";
import Fast42 from "@codam/fast42";
import { Intra } from "./utils/intra/intra";
import { app as webhookApp } from "./webhook/webhook";
import { slackApp } from "./slackbot/slack";
import { CronJob } from 'cron';

/* ************************************************************************** */

// Set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

/* ************************************************************************** */

/**
 * Delete scale teams that are older than a week.
 */
async function checkLocks() {

	let locks: Intra.ScaleTeam[] = [] 
	try { locks = await Intra.getEvaluationLocks();	} 
	catch (error) {
		Logger.err(`Failed to fetch locks: ${error}`)
	}
	if (locks.length == 0) {
		Logger.log("No outdated locks to clear");
		return;
	}

	for (const lock of locks) {
		if (lock.createdAt.getTime() >= new Date().getTime()) {
			await Intra.api.delete(`/scale_teams/${lock.id}`)
			.catch((error) => {
				Logger.err("Failed to delete lock, is intra down ?")
				return;	
			});
			
			Logger.log(`Lock deleted: ID: ${lock.id} Project: ${lock.projectSlug} Team: ${lock.teamName}`);
		}
	}
}

/* ************************************************************************** */

(async () => {
	Logger.log("Launching Peer++");
    
    Intra.api = await new Fast42([{
        client_id: env.INTRA_UID,
        client_secret: env.INTRA_SECRET
    }]).init();

	Logger.log("Connected to Intra V2");
	
	// Check everyday for our reserved locks if any of them are older than a week.
    const lockJob = new CronJob("0 0 * * *", checkLocks);
	if (!lockJob.running)
        lockJob.start();

    await webhookApp.listen(8080);
	await slackApp.start().catch((error) => {
        Logger.err(`Slack bot failed to start: ${error}`);
        return;
    });

    Logger.log("Running ...");
})();

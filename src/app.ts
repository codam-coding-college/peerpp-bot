// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import DB from "./db";
import util from "util";
import { Env } from "./env";
import { CronJob } from "cron";
import { Config, Projects } from "./config";
import Intra from "./utils/intra";
import Fast42 from "@codam/fast42";
import { Database } from "sqlite3";
import { slackApp, SlackBot } from "./bots/slackbot";
import { webhookApp } from "./bots/webhook";
import Logger, { LogType } from "./utils/logger";
import { IntraResponse } from "./utils/types";
import { captureException } from "./utils/sentry";
import { getFullUser } from "./utils/user";
import Raven from "raven";

/*============================================================================*/

/** Why checkExpiredLocks dropped a lock. */
type DropReason = "unknownProject" | "expired" | "finished";

/** The reason as reported to the staff. */
const staffReasons: Record<DropReason, string> = {
	unknownProject: "its project is no longer in the config",
	expired: "the lock expired",
	finished: "the project was already finished",
};

/** The message the team gets for the reason. */
function teamMessage(reason: DropReason, project: string): string {
	switch (reason) {
		case "unknownProject":
			return `Peer++ no longer handles \`${project}\`, so your Peer++ evaluation has been removed. You can book your final evaluation as usual.`;
		case "expired":
			return `No Peer++ evaluator booked your \`${project}\` in time, so your Peer++ evaluation has been removed. You can book your final evaluation as usual.`;
		case "finished":
			return `Your \`${project}\` is already finished, so your Peer++ evaluation has been removed.`;
	}
}

/** Tells the team why their lock was dropped. */
async function notifyTeamOfDroppedLock(lock: Intra.ScaleTeam, teamUsers: IntraResponse.TeamUser[], reason: DropReason) {
	const project = reason === "unknownProject" ? await Intra.getProjectName(lock.projectID).catch(() => lock.projectName) : lock.projectName;

	for (const teamUser of teamUsers) {
		try {
			const user = await getFullUser({ intraLogin: teamUser.user.login, intraUID: teamUser.user_id });
			await SlackBot.sendMessage(user, teamMessage(reason, project));
		} catch (error) {
			captureException(error, { action: "notifyTeamOfDroppedLock", lockID: lock.id, teamID: lock.teamID, login: teamUser.user.login });
			Logger.log(`Failed to notify ${teamUser.user.login} of their dropped lock: ${error}`, LogType.ERROR);
		}
	}
}

/** Removes the Peer++ locks that have expired, whose team already finished the project, or whose project is no longer in the config. */
async function checkExpiredLocks() {
	Logger.log("Checking for expired locks ...");

	let locks: Intra.ScaleTeam[] = [];
	try {
		locks = await Intra.getLocks();
	} catch (error) {
		captureException(error, { action: "checkExpiredLocks: Intra.getLocks" });
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
		const reason: DropReason | undefined =
			Projects.nameOf(lock.projectID) === undefined ? "unknownProject" : Date.now() >= unlockDate.getTime() ? "expired" : projectState == "finished" ? "finished" : undefined;
		if (reason !== undefined) {
			Logger.log(`Deleting lock on ${lock.teamName} for project ${lock.projectName}: ${staffReasons[reason]}`);

			try {
				await DB.markTeamHandled(lock.teamID);
				await Intra.deleteEvaluation(lock);
				Logger.log(`Deleted ScaleTeam: ${lock.id}`);
				await SlackBot.notifyStaffOfDeletedLock(
					lock,
					lockedAt,
					staffReasons[reason],
					teamU.map((teamUser) => teamUser.user.login)
				);
			} catch (error) {
				captureException(error, {
					action: "checkExpiredLocks: delete lock",
					lockID: lock.id,
					teamID: lock.teamID,
					teamName: lock.teamName,
					projectName: lock.projectName,
				});
				return Logger.log(`${error}`, LogType.ERROR);
			}
			await notifyTeamOfDroppedLock(lock, teamU, reason);
			n++;
		}
	}
	Logger.log(`Deleted: ${n} locks`);
}

/** Moves a favorites table that still stores project names over to project ids. */
async function migrateFavorites() {
	try {
		const carried = await DB.migrateFavoritesToProjectIDs();
		if (carried > 0) Logger.log(`Migrated ${carried} favorite(s) from project names to project ids`);
	} catch (reason) {
		captureException(reason, { action: "migrateFavorites" });
		Logger.log(`Failed to migrate the favorites to project ids: ${reason}`, LogType.ERROR);
	}
}

/** Deletes the handled-team records that are more than a week old. */
async function deleteOldHandledTeams() {
	Logger.log("Deleting the old handled teams from the database...");

	await DB.deleteOldHandledTeams().catch((reason) => {
		captureException(reason, { action: "deleteOldHandledTeams" });
		Logger.log(`Failed to delete the old handled teams: ${reason}`, LogType.WARNING);
	});
}

/*============================================================================*/

util.inspect.defaultOptions.depth = null;
const expirationJob = new CronJob("*/15 * * * *", checkExpiredLocks);
const emptyExpiredJob = new CronJob("0 0 * * 0", deleteOldHandledTeams);
export const db = new Database(Config.dbPath, (err) => {
	if (err !== null) {
		captureException(err, { action: "openDatabase", path: Config.dbPath });
		Logger.log(`Failed to create / open Database: ${err}`, LogType.ERROR);
		process.exit(1);
	}
});

/*============================================================================*/

/** Application entry point. */
(async () => {
	Logger.setPath(Config.logOutput);
	Logger.log("Starting Peer++ bot 🤖");
	if (Env.SENTRY_DSN) Raven.config(`${Env.SENTRY_DSN}`).install();

	Intra.api = await new Fast42([
		{
			client_id: Env.INTRA_UID,
			client_secret: Env.INTRA_SECRET,
		},
	])
		.init()
		.catch((reason) => {
			captureException(reason, { action: "Fast42.init" });
			Logger.log(`Failed to connect: ${reason}`, LogType.ERROR);
			process.exit(1);
		});
	Logger.log("Connected to Intra V2");

	await migrateFavorites();
	checkExpiredLocks();
	deleteOldHandledTeams();
	expirationJob.start();
	emptyExpiredJob.start();

	await slackApp.start();
	await webhookApp.listen(Env.WEBHOOK_PORT);
})();

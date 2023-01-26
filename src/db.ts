// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { db } from "./app";
import { Config } from "./config";
import Logger, { LogType } from "./utils/logger";
import { User } from "./utils/user";

/*============================================================================*/

async function dbRun(query: string): Promise<void> {
	return await new Promise((resolve, reject) => {
		db.run(query, (err) => {
			if (err) {
				err.message = `Query failed: "${query}"\n${err.message}`;
				return reject(err);
			}
			resolve();
		});
	});
}

async function dbGet<T>(query: string): Promise<T> {
	return new Promise((resolve, reject) => {
		db.get(query, (err, t) => {
			if (err) {
				err.message = `Query failed: "${query}"\n${err.message}`;
				return reject(err);
			}
			resolve(t);
		});
	});
}

/** SQLlite3 database wrapper functions */
namespace DB {
	/** Deletes all expiredTeam rows which are older than the lock days.  */
	export async function emptyOldLocks() {
		await dbRun(`DELETE FROM expiredTeam WHERE datetime(created_at) < datetime('now', '-${Config.lockExpirationDays} days')`);
	}

	/**
	 * Insert the given team into the database and mark them as expired.
	 * @param teamID The TeamID.
	 */
	export async function insert(teamID: number) {
		await dbRun(`INSERT INTO expiredTeam(teamID) VALUES(${teamID})`);
	}

	/**
	 * Checks wether the given teamID exists in the db.
	 * @param teamID The TeamID.
	 */
	export async function exists(teamID: number) {
		const team = await dbGet<{ amount: number }>(`SELECT COUNT(*) AS amount FROM expiredTeam WHERE teamID = ${teamID}`);
		return team.amount > 0;
	}

	export async function saveEvaluator(user: User, notify: boolean): Promise<void> {
		const { intraUID, intraLogin, slackUID, email, level, campusID } = user;
		const staff = user.staff ? 1 : 0;
		await dbRun(
			`INSERT OR REPLACE INTO evaluators(intraUID, slackUID, intraLogin, email, level, staff, campusID, notifyOfNewLock) ` +
				`VALUES(${intraUID}, '${slackUID}', '${intraLogin}', '${email}', ${level}, ${staff}, ${campusID}, ${notify})`
		);
	}

	export function allNotifiableEvaluators(onData: (user: User) => void) {
		const query = `SELECT intraUID, slackUID, intraLogin, email, level, staff, campusID FROM evaluators WHERE notifyOfNewLock = 1`;
		db.each(query, (err, row) => {
			if (err) {
				Logger.log(`Failed to get all notifiable evaluators: ${err}`, LogType.ERROR);
			} else {
				onData(row);
			}
		});
	}
}

/*============================================================================*/

export default DB;

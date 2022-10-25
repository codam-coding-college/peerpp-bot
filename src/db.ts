// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { db } from "./app";
import { Config } from "./config";

/*============================================================================*/

/** SQLlite3 database wrapper functions */
namespace DB {
	/** Deletes all expiredTeam rows which are older than the lock days.  */
	export function emptyOldLocks() {
		return new Promise<void>((resolve, reject) => {
			db.run(`DELETE FROM expiredTeam WHERE datetime(created_at) < datetime('now', '-${Config.lockExpirationDays} days')`, (err) => {
				if (err != null)
					return reject(`Failed to clear database: ${err}`);
				return resolve();
			});
		});
	}

	/**
	 * Insert the given team into the database and mark them as expired.
	 * @param teamID The TeamID.
	 */
	export function insert(teamID: number) {
		return new Promise<void>((resolve, reject) => {
			db.run(`INSERT INTO expiredTeam(teamID) VALUES(${teamID})`, (err) => {
				if (err != null)
					return reject(`Failed to insert value ${teamID}: ${err}`);
				return resolve();
			});
		});
	}

	/**
	 * Checks wether the given teamID exists in the db.
	 * @param teamID The TeamID.
	 */
	export function exists(teamID: number) {
		return new Promise<boolean>((resolve, reject) => {
			db.get(`SELECT COUNT(*) AS amount FROM expiredTeam WHERE teamID = ${teamID}`, (err, row) => {
				if (err != null)
					return reject(`Failed to check if ${teamID} exists: ${err}`);
				return resolve(row["amount"] > 0);
			});
		});
	}
}

/*============================================================================*/

export default DB;
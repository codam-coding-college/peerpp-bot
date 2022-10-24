// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { db } from "./app";

/*============================================================================*/

namespace DB {

	/**
	 * Insert the given team into the database and mark them as expired.
	 * @param teamID The TeamID.
	 */
	export function insert(teamID: number) {
		db.run(`INSERT INTO expiredTeam(teamID) VALUES(${teamID})`, (err) => {
			if (err != null) 
				throw new Error(`DB: Fail to add ${teamID}: ${err.message}`);
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
					reject(`Failed to check if ${teamID} exists: ${err}`);
				resolve(row["amount"] > 0);
			});
		});
	} 
}

/*============================================================================*/

export default DB;
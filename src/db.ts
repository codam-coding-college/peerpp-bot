// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { db } from "./app";
import { Config } from "./config";
import Logger, { LogType } from "./utils/logger";
import { User } from "./utils/user";
import Raven from "raven";

/*============================================================================*/

async function dbRun(query: string, params: any[] = []): Promise<void> {
	return new Promise((resolve, reject) => {
		db.run(query, params, (err) => (err ? reject(err) : resolve()));
	});
}

async function dbGet<T>(query: string): Promise<Partial<T>> {
	return new Promise((resolve, reject) => {
		db.get<Partial<T>>(query, (err, t) => (err ? reject(err) : resolve(t)));
	});
}

/** SQLlite3 database wrapper functions */
namespace DB {
	/** Deletes all expiredTeam rows which are older than the lock days.  */
	export function emptyOldLocks() {
		return new Promise<void>((resolve, reject) => {
			db.run(`DELETE FROM expiredTeam WHERE datetime(created_at) < datetime('now', '-${Config.lockExpirationDays} days')`, (err) => {
				if (err != null) return reject(`Failed to clear database: ${err}`);
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
				if (err != null) return reject(`Failed to insert value ${teamID}: ${err}`);
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
			db.get<{ amount: number }>(`SELECT COUNT(*) AS amount FROM expiredTeam WHERE teamID = ?`, [teamID], (err, row) => {
				if (err != null) {
					return reject(`Failed to check if ${teamID} exists: ${err}`);
				}
				return resolve(row.amount > 0);
			});
		});
	}

	export async function hasWebhookDelivery(id: string): Promise<boolean> {
		return !!(await dbGet<any>(`SELECT delivery FROM webhookDeliveries WHERE delivery = '${id}'`));
	}

	export async function addWebhookDelivery(id: string): Promise<void> {
		await dbRun(`INSERT INTO webhookDeliveries(delivery) VALUES('${id}')`);
	}

	export async function saveEvaluator(user: User): Promise<void> {
		const { intraUID, intraLogin, slackUID, email, level, campusID } = user;
		const staff = user.staff ? 1 : 0;
		await dbRun(`INSERT OR REPLACE INTO evaluators(intraUID, slackUID, intraLogin, email, level, staff, campusID, notifyOfNewLock) ` + `VALUES(?, ?, ?, ?, ?, ?, ?, 1)`, [
			intraUID,
			slackUID,
			intraLogin,
			email,
			level,
			staff,
			campusID,
		]);
	}

	/**
	 * Marks a project as one of the evaluator's favorites.
	 * @param intraUID The evaluator.
	 * @param projectName The project, lowercased.
	 */
	export async function addFavorite(intraUID: number, projectName: string): Promise<void> {
		await dbRun(`INSERT OR IGNORE INTO favorites(intraUID, projectName) VALUES(?, ?)`, [intraUID, projectName]);
	}

	/**
	 * Removes a project from the evaluator's favorites.
	 * @returns True if it was a favorite, false if there was nothing to remove.
	 */
	export async function removeFavorite(intraUID: number, projectName: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			db.run(`DELETE FROM favorites WHERE intraUID = ? AND projectName = ?`, [intraUID, projectName], function (err) {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to remove favorite ${projectName} for ${intraUID}: ${err}`);
				}
				return resolve(this.changes > 0);
			});
		});
	}

	/**
	 * Marks all the given projects as favorites of the evaluator, skipping the ones already favorited.
	 * @returns The amount of favorites that were actually added.
	 */
	export async function addFavorites(intraUID: number, projectNames: string[]): Promise<number> {
		if (projectNames.length === 0) return 0;

		const values = projectNames.map(() => `(?, ?)`).join(", ");
		const params = projectNames.flatMap((projectName) => [intraUID, projectName]);

		return new Promise((resolve, reject) => {
			db.run(`INSERT OR IGNORE INTO favorites(intraUID, projectName) VALUES ${values}`, params, function (err) {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to add the favorites of ${intraUID}: ${err}`);
				}
				return resolve(this.changes);
			});
		});
	}

	/**
	 * Removes every favorite of the given evaluator, stopping all notifications.
	 * @returns The amount of favorites that were removed.
	 */
	export async function clearFavorites(intraUID: number): Promise<number> {
		return new Promise((resolve, reject) => {
			db.run(`DELETE FROM favorites WHERE intraUID = ?`, [intraUID], function (err) {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to clear the favorites of ${intraUID}: ${err}`);
				}
				return resolve(this.changes);
			});
		});
	}

	/** The projects the given evaluator marked as favorite, lowercased. */
	export async function favoritesOf(intraUID: number): Promise<string[]> {
		return new Promise((resolve, reject) => {
			db.all<{ projectName: string }>(`SELECT projectName FROM favorites WHERE intraUID = ?`, [intraUID], (err, rows) => {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to get the favorites of ${intraUID}: ${err}`);
				}
				return resolve(rows.map((row) => row.projectName));
			});
		});
	}

	/** Calls onData for every evaluator that marked the given project as favorite. */
	export function allEvaluatorsFavoriting(projectName: string, onData: (user: User) => void) {
		const query =
			`SELECT e.intraUID, e.slackUID, e.intraLogin, e.email, e.level, e.staff, e.campusID FROM evaluators e ` +
			`INNER JOIN favorites f ON f.intraUID = e.intraUID WHERE f.projectName = ?`;
		db.each<User>(query, [projectName], (err, row) => {
			if (err) {
				Raven.captureException(err);
				Logger.log(`Failed to get evaluators favoriting ${projectName}: ${err}`, LogType.ERROR);
			} else {
				onData(row);
			}
		});
	}
}

/*============================================================================*/

export default DB;

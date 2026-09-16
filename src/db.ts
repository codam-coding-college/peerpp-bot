// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { db } from "./app";
import { Config, Projects } from "./config";
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
	/**
	 * Deletes the handled-team records that are older than the lock expiration.
	 * These live in the expiredTeam table, see markTeamHandled.
	 */
	export function deleteOldHandledTeams() {
		return new Promise<void>((resolve, reject) => {
			db.run(`DELETE FROM expiredTeam WHERE datetime(created_at) < datetime('now', '-${Config.lockExpirationDays} days')`, (err) => {
				if (err != null) return reject(`Failed to clear database: ${err}`);
				return resolve();
			});
		});
	}

	/**
	 * Marks a team as handled, so the bot ignores it from now on. A team is handled once its
	 * Peer++ lock is gone for any reason: booked by an evaluator, expired, or removed because
	 * the team failed or the bot was marked absent.
	 *
	 * Despite the table being named expiredTeam, most handled teams did not expire.
	 * @param teamID The team, a group of students' attempt at a project.
	 */
	export function markTeamHandled(teamID: number) {
		return new Promise<void>((resolve, reject) => {
			db.run(`INSERT INTO expiredTeam(teamID) VALUES(${teamID})`, (err) => {
				if (err != null) return reject(`Failed to insert value ${teamID}: ${err}`);
				return resolve();
			});
		});
	}

	/**
	 * Checks whether the bot already handled the given team, see markTeamHandled.
	 * @param teamID The team, a group of students' attempt at a project.
	 */
	export function isTeamHandled(teamID: number) {
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

	/** Stores a Peer++ evaluator so their favorites can be linked to them. */
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
	 * Moves a favorites table that still stores project names over to project ids, which is what
	 * the rest of the code expects. Favorites used to be stored by name, so renaming a project in
	 * the config silently stopped everyone that favorited it from being notified.
	 *
	 * Names are matched against the config with their spaces and hyphens replaced by underscores,
	 * because that rename is what made the ids necessary in the first place. A favorite whose
	 * project the config no longer lists is dropped, there is nothing left to notify about.
	 *
	 * Does nothing when the table already stores ids, so it can run on every startup.
	 * @returns The amount of favorites that were carried over.
	 */
	export async function migrateFavoritesToProjectIDs(): Promise<number> {
		const columns = await new Promise<{ name: string }[]>((resolve, reject) => {
			db.all<{ name: string }>(`PRAGMA table_info(favorites)`, [], (err, rows) => (err !== null ? reject(`Failed to inspect the favorites table: ${err}`) : resolve(rows)));
		});
		if (!columns.some((column) => column.name === "projectName")) return 0;

		const outdated = await new Promise<{ intraUID: number; projectName: string }[]>((resolve, reject) => {
			db.all<{ intraUID: number; projectName: string }>(`SELECT intraUID, projectName FROM favorites`, [], (err, rows) =>
				err !== null ? reject(`Failed to read the favorites to migrate: ${err}`) : resolve(rows)
			);
		});

		// One favorited name can stand for several ids, so every id behind it is carried over.
		const carried: [number, number][] = [];
		for (const { intraUID, projectName } of outdated) {
			const project = Projects.find(projectName.replace(/[\s-]/g, "_"));
			if (project === undefined) {
				Logger.log(`Dropping the favorite of ${intraUID} on "${projectName}", the config no longer lists that project`, LogType.WARNING);
				continue;
			}
			carried.push(...project.ids.map((id): [number, number] => [intraUID, id]));
		}

		await dbRun(`DROP TABLE favorites`);
		await dbRun(`CREATE TABLE favorites(intraUID INTEGER NOT NULL, projectID INTEGER NOT NULL, PRIMARY KEY(intraUID, projectID))`);
		for (const [intraUID, projectID] of carried) {
			await dbRun(`INSERT OR IGNORE INTO favorites(intraUID, projectID) VALUES(?, ?)`, [intraUID, projectID]);
		}

		return carried.length;
	}

	/**
	 * Marks all the given projects as favorites of the evaluator, skipping the ones already favorited.
	 * @returns The amount of favorites that were actually added.
	 */
	export async function addFavorites(intraUID: number, projectIDs: number[]): Promise<number> {
		if (projectIDs.length === 0) return 0;

		const values = projectIDs.map(() => `(?, ?)`).join(", ");
		const params = projectIDs.flatMap((projectID) => [intraUID, projectID]);

		return new Promise((resolve, reject) => {
			db.run(`INSERT OR IGNORE INTO favorites(intraUID, projectID) VALUES ${values}`, params, function (err) {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to add the favorites of ${intraUID}: ${err}`);
				}
				return resolve(this.changes);
			});
		});
	}

	/**
	 * Removes all the given projects from the favorites of the evaluator, skipping the ones that were not favorited.
	 * @returns The amount of favorites that were actually removed.
	 */
	export async function removeFavorites(intraUID: number, projectIDs: number[]): Promise<number> {
		if (projectIDs.length === 0) return 0;

		const placeholders = projectIDs.map(() => `?`).join(", ");
		const params = [intraUID, ...projectIDs];

		return new Promise((resolve, reject) => {
			db.run(`DELETE FROM favorites WHERE intraUID = ? AND projectID IN (${placeholders})`, params, function (err) {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to remove the favorites of ${intraUID}: ${err}`);
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

	/** The ids of the projects the given evaluator marked as favorite. */
	export async function favoritesOf(intraUID: number): Promise<number[]> {
		return new Promise((resolve, reject) => {
			db.all<{ projectID: number }>(`SELECT projectID FROM favorites WHERE intraUID = ?`, [intraUID], (err, rows) => {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to get the favorites of ${intraUID}: ${err}`);
				}
				return resolve(rows.map((row) => row.projectID));
			});
		});
	}

	/** Every favorite, with the login of the evaluator that marked it. */
	export async function allFavorites(): Promise<{ projectID: number; intraLogin: string }[]> {
		const query = `SELECT f.projectID, e.intraLogin FROM favorites f ` + `INNER JOIN evaluators e ON e.intraUID = f.intraUID ORDER BY e.intraLogin`;

		return new Promise((resolve, reject) => {
			db.all<{ projectID: number; intraLogin: string }>(query, [], (err, rows) => {
				if (err !== null) {
					Raven.captureException(err);
					return reject(`Failed to get all favorites: ${err}`);
				}
				return resolve(rows);
			});
		});
	}

	/** Calls onData for every evaluator that marked the given project as favorite. */
	export function allEvaluatorsFavoriting(projectID: number, onData: (user: User) => void) {
		const query =
			`SELECT e.intraUID, e.slackUID, e.intraLogin, e.email, e.level, e.staff, e.campusID FROM evaluators e ` +
			`INNER JOIN favorites f ON f.intraUID = e.intraUID WHERE f.projectID = ?`;
		db.each<User>(query, [projectID], (err, row) => {
			if (err) {
				Raven.captureException(err);
				Logger.log(`Failed to get evaluators favoriting project ${projectID}: ${err}`, LogType.ERROR);
			} else {
				onData(row);
			}
		});
	}
}

/*============================================================================*/

export default DB;

// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { IncompleteUser } from "./user";
import Fast42 from "@codam/fast42";
import { Config } from "../config";
import { IntraResponse } from "./types";
import Logger from "./logger";

/*============================================================================*/

/** Utility functions for interacting with the Intra API. */
export namespace Intra {
	export let api: Fast42;
	export type Login = string | number;

	export interface ScaleTeam {
		/** The ScaleTeamID itself. */
		id: number;
		/** The ID of the evaluation sheet to be used. */
		scaleID: number;
		/** The ID of the team by the matching of corrector and corrected. */
		teamID: number;
		/** The name of the team. */
		teamName: string;
		/** The id of the project. E.g: 1314 */
		projectID: number;
		/** The slugname of the project. E.g: libft */
		projectName: string;
		/** The creation date of the evaluation. */
		createdAt: Date;
		/** The grade given by the corrector. */
		finalMark?: number;
		/** The user doing the correction */
		corrector: IncompleteUser;
		/** The users that are part of the team to be corrected. */
		correcteds: IncompleteUser[];
	}

	/**
	 * Checks if the given user has completed a given project.
	 * @param user The user.
	 * @param name The display name of the project, not slug. E.g Config file.
	 * @returns True if the user did the project, else false.
	 */
	export async function validatedProject(user: Login, name: string) {
		const pages = await api.getAllPages(`/users/${user}/projects_users`);
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get project users for ${user}: ${reason}`);
		});

		for await (const page of pages) {
			if (!page.ok) throw new Error(`Failed to get projects_users: ${page.status}`);
			const projectUsers = (await page.json()) as any[];

			for (const projectUser of projectUsers) {
				if (projectUser.project.name.toLowerCase() == name && projectUser["validated?"] != null && projectUser["validated?"] == true) return true;
			}
		}
		return false;
	}

	/**
	 * Checks if the given user has completed a the common core.
	 * @param user The user.
	 * @returns True if the user did the complete it, else false.
	 */
	export async function hasCompletedCore(user: Login) {
		const pages = await api.getAllPages(`/users/${user}/quests_users`);
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get project users for ${user}: ${reason}`);
		});

		for await (const page of pages) {
			if (!page.ok) throw new Error(`Failed to get quests_users: ${page.status}`);
			const quests = await page.json();
			const quest = quests.find((x: any) => x.quest_id == 59);

			if (quest == undefined)
				continue;
			else if (quest.validated_at != null)
				return true;
		}
		return false;
	}

	/**
	 * Check wether the given mark is sufficient enough to be considered a passing grade.
	 * @param projectID The project to check.
	 * @param mark The given 'grade'
	 */
	export async function markIsPass(projectID: number, mark: number) {
		const projectResponse = await Intra.api.get(`/projects/${projectID}`, {
			"filter[cursus_id]": `${Config.cursusID}`,
		});
		if (!projectResponse.ok) throw new Error(`Failed to fetch project ${projectID}: ${projectResponse.statusText}`);

		const projectData = await projectResponse.json();
		const projectSessions = projectData.project_sessions as any[];

		let minimumMark: number = 80;
		const defaultSession = projectSessions.find((value) => value.campus_id == null && value.cursus_id == null);
		const session = projectSessions.find((value) => value.campus_id == Config.campusID);

		if (session !== undefined) minimumMark = session.minimum_mark;
		else if (defaultSession !== undefined) minimumMark = defaultSession.minimum_mark;
		return mark >= minimumMark;
	}

	/**
	 * Checks wether the given user belongs to a given group.
	 * @param user The user.
	 * @param groupID The group id to check.
	 */
	export async function hasGroup(user: Login, groupID: number): Promise<boolean> {
		const response = await api.get(`/users/${user}/groups_users`);
		if (!response.ok) throw new Error(`Failed to fetch groups_users for user ${user}, groupID ${groupID}: ${response.statusText}`);

		const groups = (await response.json()) as any[];
		return groups.find((value: any) => value.group.id === groupID) != undefined;
	}

	/**
	 * Fetch all team users of the given team.
	 * @param teamID The team id.
	 */
	export async function getTeamUsers(teamID: number) {
		const response = await api.get(`/teams/${teamID}/teams_users`);
		if (!response.ok) throw new Error(`Failed to fetch teams_users for team ${teamID}: ${response.statusText}`);
		return (await response.json()) as IntraResponse.TeamUser[];
	}

	/**
	 * Fetches all the placeholder evaluations of the bot.
	 * @returns All currently booked evaluations by the bot.
	 */
	export async function getBotEvaluations() {
		const pages = await api.getAllPages(`/users/${Config.botID}/scale_teams`, {
			"filter[campus_id]": `${Config.campusID}`,
			"filter[cursus_id]": `${Config.cursusID}`,
		});
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluation locks for bot (user ${Config.botID}): ${reason}`);
		});

		const locks: Intra.ScaleTeam[] = [];
		for await (const page of pages) {
			if (!page.ok) throw new Error(`Failed to get evaluation locks: ${page.status}`);

			const locksData = await page.json();
			for (const lock of locksData) {
				const project = Config.projects.find((p) => p.id === lock.team.project_id)!;
				const tempLock: ScaleTeam = {
					id: lock.id,
					scaleID: lock.scale_id,
					teamID: lock.team.id,
					teamName: lock.team.name,
					projectID: project.id,
					projectName: project.name.toLowerCase(),
					createdAt: new Date(lock.created_at),
					corrector: { intraLogin: lock.corrector.login, intraUID: lock.corrector.id },
					correcteds: lock.correcteds.map((c) => ({ intraLogin: c.login, intraUID: c.id })),
				};
				locks.push(tempLock);
			}
		}
		return locks;
	}

	/**
	 * Get the evaluations of a given, project, scale and team ID.
	 * @param projectID The project ID.
	 * @param scaleID The scale used to evaluate the evaluation.
	 * @param teamID The team id.
	 * @returns All the evaluations of that specific team of a given project.
	 */
	export async function getEvaluations(projectID: number, scaleID: number, teamID: number) {
		const pages = await api.getAllPages(`/projects/${projectID}/scale_teams`, {
			"filter[scale_id]": scaleID.toString(),
			"filter[team_id]": teamID.toString(),
			"filter[campus_id]": `${Config.campusID}`,
			"filter[cursus_id]": `${Config.cursusID}`,
		});
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluations for projectID ${projectID}, scaleID ${scaleID}, teamID ${teamID}: ${reason}`);
		});

		// Another API call to simply fetch the name of the project.
		const projectResponse = await api.get(`/projects/${projectID}`);
		if (!projectResponse.ok) throw new Error(`Failed to get project ${projectID}: ${projectResponse.statusText}`);
		const project = await projectResponse.json();

		const evals: Intra.ScaleTeam[] = [];
		for await (const page of pages) {
			const evaluations = (await page.json()) as any[];
			for (const evaluation of evaluations) {
				// Skip absent users, those evaluations don't count
				if (evaluation.truant.id !== undefined) continue;

				evals.push({
					id: evaluation.id,
					scaleID: scaleID,
					teamID: teamID,
					teamName: evaluation.team.name,
					projectID: projectID,
					finalMark: evaluation.final_mark,
					projectName: (project.name as string).toLowerCase(),
					createdAt: new Date(evaluation.created_at),
					corrector: { intraLogin: evaluation.corrector.login, intraUID: evaluation.corrector.id },
					correcteds: evaluation.correcteds.map((c) => ({ intraLogin: c.login, intraUID: c.id })),
				});
			}
		}
		return evals;
	}

	/**
	 * Returns all the evaluations as a corrector withing a given
	 * @param user The user to fetch the evaluations from.
	 * @param numDays The day range, for instance 7 days in the past and future.
	 * @param type The type of evaluations to get the user as, say as being corrected or as corrector.
	 * @returns All the evaluations of the given period and type.
	 */
	export async function getRecentEvaluations(user: Login, numDays: number, type: "as_corrector" | "as_corrected") {
		const past = new Date();
		const future = new Date();
		past.setDate(past.getDate() - numDays);
		future.setDate(future.getDate() + numDays);

		const pages = await Intra.api.getAllPages(`user/${user}/scale_teams/${type}`, {
			"filter[campus_id]": `${Config.campusID}`,
			"filter[cursus_id]": `${Config.cursusID}`,
			"range[created_at]": `${past.toISOString()},${future.toISOString()}`,
		});
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluations between ${past.toISOString()} and ${future.toISOString()} for ${user}: ${reason}`);
		});

		const evals: Intra.ScaleTeam[] = [];
		for await (const page of pages) {
			if (!page.ok) throw new Error(`Failed to get scale_teams: ${page.statusText}`);

			const evaluations = (await page.json()) as any[];
			for (const evaluation of evaluations) {
				// NOTE (W2): Avoid another API call by just looking for projects you can book.
				const project = Config.projects.find((p) => p.id === evaluation.team.project_id);
				if (project === undefined) {
					continue;
				}

				evals.push({
					id: evaluation.id,
					scaleID: evaluation.scale_id,
					teamID: evaluation.team.id,
					teamName: evaluation.team.name,
					projectID: project.id,
					finalMark: evaluation.final_mark,
					projectName: (project.name as string).toLowerCase(),
					createdAt: new Date(evaluation.created_at),
					corrector: { intraLogin: evaluation.corrector.login, intraUID: evaluation.corrector.id },
					correcteds: evaluation.correcteds.map((c) => ({ intraLogin: c.login, intraUID: c.id })),
				});
			}
		}
		return evals;
	}

	/**
	 * Book an evaluation.
	 * @param scaleID The scale/eval sheet to use.
	 * @param teamID The team id.
	 * @param correctorID The user id of the corrector.
	 * @param date The date on which to book it for.
	 */
	export async function bookEvaluation(scaleID: number, teamID: number, correctorID: number, date: Date) {
		const body = {
			scale_teams: [
				{
					begin_at: date.toISOString(),
					scale_id: scaleID.toString(),
					team_id: teamID.toString(),
					user_id: correctorID,
				},
			],
		};

		const scaleTeamResponse = await api.post("/scale_teams/multiple_create", body);
		if (!scaleTeamResponse.ok) throw new Error(`Failed to book evaluation with scaleID ${scaleID}, teamID ${teamID}, correctorID ${correctorID} on ${date.toISOString()}: ${scaleTeamResponse.statusText}`);
	}

	/**
	 * Books a placeholder evaluation that will later delete itself.
	 * @param scaleID The evaluation sheet id.
	 * @param teamID The team to book the eval for.
	 */
	export async function bookPlaceholderEval(scaleID: number, teamID: number) {
		const expireDate = new Date(Date.now() + Config.lockExpirationDays * 24 * 60 * 60 * 1000);
		await bookEvaluation(scaleID, teamID, Config.botID, expireDate);
	}

	/**
	 * Returns a point to each one in the team.
	 * @param hook The webhook response carrying the ScaleTeam.
	 */
	export async function givePointToTeam(teamID: number) {
		const teamResponse = await Intra.api.get(`/teams/${teamID}/teams_users`);
		if (!teamResponse.ok) throw new Error(`Failed to fetch team ${teamID}: ${teamResponse.statusText}`);
		const teamUsers = await teamResponse.json();

		// Remove from the pool.
		const pointsToRemove = teamUsers.length;
		const pointRemResponse = await Intra.api.delete(`/pools/${Config.poolID}/points/remove`, { points: pointsToRemove });
		if (!pointRemResponse.ok) throw new Error(`Failed to remove ${pointsToRemove} points from pool ${Config.poolID}: ${pointRemResponse.statusText}`);

		// Give them back.
		for (const teamUser of teamUsers) {
			Logger.log(`Gave a point to: ${teamUser.user.login}`);
			const pointAddResponse = await Intra.api.post(`/users/${teamUser.user.id}/correction_points/add`, {
				reason: "Peer++ Evaluation lock refund",
			});
			if (!pointAddResponse.ok) throw new Error(`Failed to give a point to ${teamUser.user.id}: ${pointRemResponse.statusText}`);
		}
	}

	/**
	 * Deletes an evaluation, does not reward back the evaluation point however.
	 * @param scaleTeam The evaluation to delete.
	 */
	export async function deleteEvaluation(scaleTeam: ScaleTeam) {
		const responseDelete = await Intra.api.delete(`/scale_teams/${scaleTeam.id}`, {});
		if (!responseDelete.ok) throw new Error(`Failed to delete evaluation lock with scale_team id ${scaleTeam.id}: ${responseDelete.statusText}`);
	}
}

/*============================================================================*/

export default Intra;

// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { IncompleteUser } from "./user";
import Fast42 from "@codam/fast42";
import { Config } from "../config";

/*============================================================================*/

/** Utility functions for interacting with the Intra API. */
export namespace Intra {
	export let api: Fast42;
	export type Login = string | number

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
	 * Checks if the given user has completed a gievn project.
	 * @param user The user.
	 * @param name The display name of the project, not slug. E.g Config file.
	 * @returns True if the user did the project, else false.
	 */
	export async function validatedProject(user: Login, name: string) {
		const pages = await api.getAllPages(`/users/${user}/projects_users`);
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get project users: ${reason}`);
		});

		for await (const page of pages) {
			if (!page.ok)
				throw new Error(`Failed to get projects: ${page.status}`);

			const projectUsers = (await page.json()) as any[];
			return (projectUsers.find(value => value.project.name.toLowerCase() === name.toLowerCase() && 
					value["validated?"]) !== undefined);
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
			"filter[campus_id]": `${Config.campusID}`,
			"filter[cursus_id]": `${Config.cursusID}`
		});
		if (!projectResponse.ok)
			throw new Error(`Failed to fetch project: ${projectResponse.statusText}`);

		const projectData = await projectResponse.json();
		const projectSession = projectData.project_sessions as any[];
		const minimum_mark = projectSession.find((value) => value.campus_id == Config.campusID);
		return mark >= (minimum_mark as number);
	}

	/**
	 * Checks wether the given user belongs to a given group.
	 * @param user The user.
	 * @param groupID The group id to check.
	 */
	export async function hasGroup(user: Login, groupID: number): Promise<boolean> {
		const response = await api.get(`/users/${user}/groups_users`);
		if (!response.ok)
			throw new Error(`Failed to fetch user groups: ${response.statusText}`);

		const groups = await response.json() as any[];
		return groups.find((value: any) => value.group.id === groupID) != undefined;
	}

	/** 
	 * Fetches all the placeholder evaluations of the bot.
	 * @returns All currently booked evaluations by the bot.
	 */
	export async function getBotEvaluations() {
		const pages = await api.getAllPages(`/users/${Config.botID}/scale_teams`, {
			"filter[campus_id]": `${Config.campusID}`,
			"filter[cursus_id]": `${Config.cursusID}`
		});
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluations: ${reason}`);
		});

		const locks: Intra.ScaleTeam[] = []
		for await (const page of pages) {
			if (!page.ok)
				throw new Error(`Failed to get evaluation locks: ${page.status}`);

			const locksData = await page.json();
			for (const lock of locksData) {
				const project = Config.projects.find(p => p.id === lock.team.project_id)!;
				const tempLock: ScaleTeam = {
					id: lock.id,
					scaleID: lock.scale_id,
					teamID: lock.team.id,
					teamName: lock.team.name,
					projectID: project.id,
					projectName: project.name.toLowerCase(),
					createdAt: new Date(lock.created_at),
					corrector: { intraLogin: lock.corrector.login, intraUID: lock.corrector.id },
					correcteds: lock.correcteds.map(c => ({ intraLogin: c.login, intraUID: c.id }))
				}
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
			"filter[cursus_id]": `${Config.cursusID}`
		});
		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluations: ${reason}`);
		})

		// Another API call to simply fetch the name of the project.
		const projectResponse = await api.get(`/projects/${projectID}`);
		if (!projectResponse.ok)
			throw new Error(`Failed to get project: ${projectResponse.statusText}`);
		const project = await projectResponse.json();

		const evals: Intra.ScaleTeam[] = []
		for await (const page of pages) {
			const evaluations = await page.json() as any[];
			for (const evaluation of evaluations) {
				const tempLock: ScaleTeam = {
					id: evaluation.id,
					scaleID: scaleID,
					teamID: teamID,
					teamName: evaluation.team.name,
					projectID: projectID,
					finalMark: evaluation.final_mark,
					projectName: (project.name as string).toLowerCase(),
					createdAt: new Date(evaluation.created_at),
					corrector: { intraLogin: evaluation.corrector.login, intraUID: evaluation.corrector.id },
					correcteds: evaluation.correcteds.map(c => ({ intraLogin: c.login, intraUID: c.id }))
				}
				evals.push(tempLock);
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
		if (!scaleTeamResponse.ok)
			throw new Error(`Failed to book evaluation ${scaleTeamResponse.statusText}`);
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
}

/*============================================================================*/

export default Intra;

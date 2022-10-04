import { env } from "../env";
import Logger from "../log";
import Fast42 from "@codam/fast42";
import { IncompleteUser, IntraResponse, User } from "../types";

/* ************************************************************************** */

/**
 * Intra api utils
 */
export namespace Intra {
	// Intra V2 endpoint
	export let api: Fast42;

	// Simplified evaluation object (TODO: Nuke this abomination or smth), really not needed ...
	// But parts of the codebase use this so maybe later.
	export interface ScaleTeam {
		id: number; // the id of the evaluation itself
		scaleID: number; // the id of the type of evaluation (v1 or v2 or whatever)
		teamID: number; // the id of the team created by the matching of corrector and corrected
		teamName: string;
		projectID: number; // eg: 1314  - the id of the project to be evaluated
		projectSlug: string; // eg: libft - the slug of the project id
		createdAt: Date;
		correcteds: IncompleteUser[];
	}

	/**
	 * Retreive all the evaluation that are booked by the bot itself.
	 * 
	 * @note Technically evaluations where the bot is to be evaluated count as well. But that won't happen (I think).
	 * @returns The booked evaluations by this bot.
	 */
	 export async function getEvaluationLocks(): Promise<ScaleTeam[]> {
		const pages = await api.getAllPages(`/users/${env.PEERPP_BOT_UID}/scale_teams`, {
			"filter[future]": "true",
		});

		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluations: ${reason}`);
		})
	
		const teams: Intra.ScaleTeam[] = []
		for await (const page of pages) {
			if (!page.ok) {
				Logger.err(`Failed to get evaluation locks with status ${page.status}`);
				throw new Error("Failed to get evaluation locks");
			}

			const scaleTeams = await page.json() as IntraResponse.Evaluation[];
			if (scaleTeams.length == 0) {
				Logger.log("No locks!");
				continue;
			}
			
			// Convert Evaluation to a simplified ScaleTeam
			for (const scaleTeam of scaleTeams) {
				const lock: ScaleTeam = {
					id: scaleTeam.id,
					scaleID: scaleTeam.scale_id,
					teamID: scaleTeam.team.id,
					teamName: scaleTeam.team.name,
					projectID: scaleTeam.team.project_id,
					projectSlug: env.projects.find(p => p.id === scaleTeam.team.project_id)!.slug,
					createdAt: new Date(scaleTeam.created_at),
					correcteds: scaleTeam.correcteds.map(c => ({ intraLogin: c.login, intraUID: c.id }))
				}	
				teams.push(lock);
			}
		}
		return teams;
	}

	/**
	 * Adds the given user to a group.
	 * @param groupID The group id.
	 * @param login The user login.
	 */
	export async function addToGroup(groupID: number, login: string): Promise<void> {
		await api.post("/groups_users", {
			groups_user: { group_id: groupID, user_id: login },
		}).catch((reason: any) => {
			Logger.err(`Failed to add to group ${reason}`);
		}).then((response) => {
			Logger.log("Added to group!");
		});
	}

	/**
	 * 
	 * @param projectID
	 * @param scaleID
	 * @param teamID
	 * @returns
	 */
	export async function getEvaluations(projectID: number, scaleID: number, teamID: number
	): Promise<IntraResponse.Evaluation[]> {

		const pages = await api.getAllPages(`/projects/${projectID}/scale_teams`, {
			"filter[scale_id]": scaleID.toString(),
			"filter[team_id]": teamID.toString(),
		});

		await Promise.all(pages).catch((reason) => {
			throw new Error(`Failed to get evaluations: ${reason}`);
		})
	
		// Merge all the pages
		let evaluations: IntraResponse.Evaluation[] = []
		for await (const page of pages) {
			const evals = await page.json() as IntraResponse.Evaluation[];
			evaluations.push(...evals);
		}
		return evaluations;
	}

	/**
	 * Book an evaluation
	 * @param scaleID The scale/eval sheet to use.
	 * @param teamID The team id.
	 * @param correctorID The user id of the corrector.
	 * @param date The date on which to book it for.
	 */
	export async function bookEval(scaleID: number, teamID: number, correctorID: number, date: Date) {
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

		await api.post("/scale_teams/multiple_create", body)
		.catch((reason: any) => {
			Logger.err(`Failed to book evaluation ${reason}`);
		});
	}

	/**
	 * Books a placeholder evaluation that will later delete itself.
	 * @param scaleID The evaluation sheet id.
	 * @param teamID The team to book the eval for.
	 */
	export async function bookPlaceholderEval(scaleID: number, teamID: number) {
		const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		await bookEval(scaleID, teamID, env.PEERPP_BOT_UID, nextWeek);
	}

	/**
	 *
	 * @param user
	 * @returns
	 */
	export async function isPeerPPAdmin(user: User): Promise<boolean> {
		// TODO: Change this to later just check if user is a staff member.
		const admins = ["joppe", "jkoers", "fbes", "freek", "lde-la-h", "leon"];
		return admins.includes(user.intraLogin) || user.staff;
	}
}

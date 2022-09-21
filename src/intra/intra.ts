import Fast42 from "@codam/fast42";
import { env } from "../env";
import { IncompleteUser } from "../getUser";
import Logger from "../log";
import { IntraResponse, User } from "../types";

/**
 * Intra api utils
 */
export namespace Intra {
	// Intra V2 endpoint
	export let api: Fast42;
	export type Login = string;
	export type UID = number;

	// Evaluation object
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
	 * Retreive all the evaluation that are 
	 * @returns 
	 */
	export async function getEvaluationLocks(): Promise<ScaleTeam[]> {
		const pages = await api.getAllPages(`/v2/users/${env.PEERPP_BOT_UID}/scale_teams`, {
			"filter[future]": "true",
		});

		await Promise.all(pages)
		const teams: ScaleTeam[] = []
		for await (const response of pages) {
			if (!response.ok) {
				Logger.err(`Failed to get evaluation locks with status ${response.status}`);
				throw Error("Failed to get evaluation locks");
			}

			Logger.log(await response.json())

			// const scaleTeam: ScaleTeam = {
			// 	id: response["id"],
			// 	scaleID: response["scale_id"],
			// 	teamID: response["team"]["id"],
			// 	teamName: response["team"]["name"],
			// 	projectID: response["team"]["project_id"] as number,
			// 	projectSlug: env.projects.find((p) => p.id === response["team"]!["project_id"])!.slug,
			// 	createdAt: new Date(response["created_at"]),

			// 	correcteds: response.correcteds.map((c) => ({
			// 		intraLogin: c.login,
			// 		intraUID: c.id,
			// 	})),
			// }
			// teams.push(scaleTeam)
		}
		return teams;
	}

	/**
	 * Adds the given user to a group.
	 * @param groupID The group id.
	 * @param login The user login.
	 */
	export async function addToGroup(groupID: number, login: string): Promise<void> {
		await api.post("/v2/groups_users", {
			groups_user: { group_id: groupID, user_id: login },
		}).catch((reason: any) => {
			Logger.err(`Failed to add to group ${reason}`);
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

		const pages = await api.getAllPages(`/v2/projects/${projectID}/scale_teams`, {
			"filter[scale_id]": scaleID.toString(),
			"filter[team_id]": teamID.toString(),
		});

		await Promise.all(pages)
		const evaluations: IntraResponse.Evaluation[] = []
		for await (const response of pages) {
			if (!response.ok) {
				Logger.err(`Failed to get evaluation with status ${response.status} for team id ${teamID}`);
				throw Error("Failed to get evaluation");
			}
			evaluations.push(await response.json());
		}

		return evaluations;
	}

	/**
	 *
	 * @param scaleID
	 * @param teamID
	 * @param correctorID
	 * @param date
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

		await api.post("/v2/scale_teams/multiple_create", body
		).catch((reason: any) => {
			Logger.err(`Failed to book evaluation ${reason}`);
		});
	}

	/**
	 * Books 
	 * @param scaleID
	 * @param teamID
	 */
	export async function bookPlaceholderEval(scaleID: number, teamID: number): Promise<void> {
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

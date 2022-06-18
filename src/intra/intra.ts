import { api } from '../api'
import { env } from '../env'
import { IncompleteUser } from '../getUser'

export namespace Intra {

	export type Login = string
	export type UID = number

	export interface ScaleTeam {
		id: number						// the id of the evaluation itself
		scaleID: number					// the id of the type of evaluation (v1 or v2 or whatever)
		teamID: number					// the id of the team created by the matching of corrector and corrected
		projectID: number				// eg: 1314  - the id of the project to be evaluated
		projectSlug: string				// eg: libft - the slug of the project id
		createdAt: Date
		correcteds: IncompleteUser[]
	}

	export async function getEvaluationLocks(): Promise<ScaleTeam[]> {
		const { json } = await api.getPaged(`/v2/users/${env.PEERPP_BOT_UID}/scale_teams?filter[future]=true`)
		const locks: ScaleTeam[] = json.map(evaluation => ({
			id: evaluation['id']!,
			scaleID: evaluation['scale_id']!,
			teamID: evaluation['team']['id']!,
			projectID: evaluation['team']['project_id'] as number,
			projectSlug: env.projectSlugs[String(evaluation['team']!['project_id']!)] as string,
			createdAt: new Date(evaluation['created_at'])!,
			correcteds: evaluation.correcteds.map(c => ({ intraLogin: c.login, intraUID: c.id })),
		}))

		return locks
	}
	// getEvaluationLocks()

	export async function addToGroup(groupID: number, login: Login): Promise<void> {
		const groupUser = { groups_user: { group_id: groupID, user_id: login } }
		await api.post('/v2/groups_users', groupUser)
	}

	export async function getEvals(projectID: number, scaleID: number, teamID): Promise<any> {
		const { json } = await api.getPaged(`/v2/projects/${projectID}/scale_teams?filter[scale_id]=${scaleID}&filter[team_id]=${teamID}`)
		return json
	}

	export async function bookEval(scaleID: number, teamID: number, correctorID: number, date: Date) {
		const body = {
			scale_teams: [{
				begin_at: date.toISOString(),
				scale_id: String(scaleID),
				team_id: String(teamID),
				user_id: correctorID,
			}]
		}
		await api.post('/v2/scale_teams/multiple_create', body)
	}

	export async function bookPlaceholderEval(scaleID: number, teamID: number): Promise<void> {
		const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		await bookEval(scaleID, teamID, env.PEERPP_BOT_UID, nextWeek)
	}

}

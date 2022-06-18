import { api } from '../api'
import { User } from '../types'
import { env } from '../env'
import { IncompleteUser } from '../getUser'

export namespace Intra {

	export type Login = string
	export type UID = number

	export interface ScaleTeam {
		id: number
		scaleID: number
		teamID: number
		createdAt: Date
		correcteds: IncompleteUser[]
	}

	export interface EvaluationLock {
		projectID: number
		projectName: string
		scaleTeams: ScaleTeam[]
	}

	export async function getEvaluationLocks(): Promise<EvaluationLock[]> {
		const { json } = await api.getPaged(`/v2/users/${env.PEERPP_BOT_UID}/scale_teams?filter[future]=true`)

		const locks: EvaluationLock[] = []
		for (const evaluation of json) {

			const scaleTeam: ScaleTeam = {
				id: evaluation['id']!,
				scaleID: evaluation['scale_id']!,
				teamID: evaluation['team_id']!,
				createdAt: new Date(evaluation['created_at'])!,
				correcteds: evaluation.correcteds.map(c => ({ intraLogin: c.login, intraUID: c.id }))
			}
			if (!locks.find(project => project.projectID == evaluation['team']['project_id'])) {
				locks.push({
					projectID: evaluation['team']['project_id'] as number,
					projectName: env.projectSlugs[String(evaluation['team']!['project_id']!)] as string,
					scaleTeams: []
				})
			}
			const project = locks.find(project => project.projectID == evaluation['team']['project_id']) as EvaluationLock
			project.scaleTeams.push(scaleTeam)
			project.scaleTeams.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
		}
		return locks
	}

	export async function addToGroup(groupID: number, login: Login): Promise<void> {
		const groupUser = { groups_user: { group_id: groupID, user_id: login } }
		await api.post('/v2/groups_users', groupUser)
	}

}

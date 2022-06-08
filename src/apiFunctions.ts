import { env } from './env'
import { API } from './api'

const api: API = new API(env.INTRA_UID, env.INTRA_SECRET)

export interface ScaleTeam {
	id: number
	scaleID: number
	teamID: number
	createdAt: Date
	correcteds: {
		id: number
		login: string
		url: string
	}[]
}

export interface EvaluationLock {
	projectID: number
	projectName: string
	scaleTeams: ScaleTeam[]
}


// example
// [
// 	{
// 		"projectID": 1314,
// 		"projectName": "libft",
// 		"scaleTeams": [
// 			{
// 				"id": 4204397,
// 				"scaleID": 14111,
// 				"createdAt": "2022-06-08T18:55:34.305Z",
// 				"correcteds": [
// 					{
// 						"id": 105119,
// 						"login": "joppe",
// 						"url": "https://api.intra.42.fr/v2/users/joppe"
// 					}
// 				]
// 			}
// 		]
// 	}
// ]
export async function getEvaluationLocks(): Promise<EvaluationLock[]> {
	const response = await api.getPaged(`/v2/users/${env.PEERPP_BOT_UID}/scale_teams?filter[future]=true`)

	const locks: EvaluationLock[] = []
	for (const evaluation of response) {

		const scaleTeam: ScaleTeam = {
			id: evaluation['id']!,
			scaleID: evaluation['scale_id']!,
			teamID: evaluation['team_id']!,
			createdAt: new Date(evaluation['created_at'])!,
			correcteds: evaluation.correcteds
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
	}
	return locks
}

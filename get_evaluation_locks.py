import codamconnector
from constants import PEERPP_BOT_UID, PROJECTS, GET_EVALUATION_LOCKS_TTL
import json
from datetime import datetime

endpoint = codamconnector.IntraConnector()

last_sync = 0
evaluations_cache = None


def get_evaluations():
	global last_sync
	global evaluations_cache
	now = datetime.now().timestamp()
	if now - last_sync < GET_EVALUATION_LOCKS_TTL:
		return evaluations_cache

	last_sync = now
	exchange = codamconnector.Exchange(f'users/{PEERPP_BOT_UID}/scale_teams?filter[future]=true')
	endpoint.get(exchange)
	evaluations_cache = exchange.result
	return exchange.result


# returns:
# [
# 	{
# 		"project_name": "libft",
# 		"project_id": 1314,
# 		"scale_teams": [
# 			{
# 				"id": 4150148,
# 				"scale_id": 12637,
# 				"team_id": 4137158,
# 				"created_at": "2022-05-18 09:49:09+0000",
# 				"correcteds": [
# 					{
# 						"id": 105119,
# 						"login": "joppe",
# 						"url": "https://api.intra.42.fr/v2/users/joppe"
# 					}
# 				]
# 			}
# 		]
# 	}
# ]
# The first object in the array is the project with the most priority
# The first object in the project's scale_teams array is the one with the most priority
def get_evaluation_locks():

	projects = []
	for evaluation in get_evaluations():
		scale_team = {}
		scale_team['id'] = evaluation.id
		scale_team['scale_id'] = evaluation.scale_id
		scale_team['team_id'] = evaluation.team.id
		scale_team['created_at'] = evaluation.created_at.isoformat()
		scale_team['correcteds'] = []
		for corrected in evaluation.correcteds:
			copy = {}
			copy['id'] = corrected.id
			copy['login'] = corrected.login
			copy['url'] = corrected.url
			scale_team['correcteds'].append(copy)

		eval_index = -1
		for i, project in enumerate(projects):
			if project['project_id'] == evaluation.team.project_id:
				eval_index = i
		if eval_index == -1:
			new_evaluation = {}
			new_evaluation['project_id'] = evaluation.team.project_id
			new_evaluation['project_name'] = PROJECTS[evaluation.team.project_id]
			new_evaluation['scale_teams'] = []
			projects.append(new_evaluation)

		projects[eval_index]['scale_teams'].append(scale_team)
		projects[eval_index]['scale_teams'].sort(key=lambda t: t['created_at'])
	projects.sort(key=lambda p: p['scale_teams'][0]['created_at'])
	return projects

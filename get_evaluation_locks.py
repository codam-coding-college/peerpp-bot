import codamconnector
from constants import PEERPP_BOT_UID, PROJECTS, GET_EVALUATION_LOCKS_TTL
import json
from datetime import datetime

endpoint = codamconnector.IntraConnector()


# returns:
# [
# 	{
# 		"project_name": "libft",
# 		"project_id": 1314, 								# the id of the project to be evaluated
# 		"scale_teams": [
# 			{
# 				"id": 4150148,								# the id of the evaluation itself
# 				"scale_id": 12637,							# the id of the type of evaluation (v1 or v2 or whatever)
# 				"team_id": 4137158,							# the id of the team created by the matching of evaluator and evaluee
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
	exchange = codamconnector.Exchange(f'users/{PEERPP_BOT_UID}/scale_teams?filter[future]=true')
	endpoint.get(exchange)

	projects = []
	for evaluation in exchange.result:
		scale_team = {}
		scale_team['id'] = evaluation.id
		scale_team['scale_id'] = evaluation.scale_id
		scale_team['team_id'] = evaluation.team.id
		scale_team['created_at'] = evaluation.created_at.timestamp()
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


# The id is the scale_teams[i].id as returned by get_evaluation_locks()
def delete_evaluation_lock(evaluation_id):
	exchange = codamconnector.Exchange(f'scale_teams/{evaluation_id}')
	endpoint.delete(exchange)
	return exchange.result

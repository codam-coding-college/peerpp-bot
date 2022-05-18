from typing import List, Set, Dict, Tuple, Optional
import os
from decouple import config


def get_projects() -> Dict[int, str]:
	projects = dict()
	with open("project_ids", "r+") as projects_f:
		lines = projects_f.readlines()
	for line in lines:
		project_name, project_id = line.strip().split('=')
		projects[int(project_id)] = project_name.lower()
	return projects


CAMPUS_ID = 14
SLACK_TOKEN = config('SLACK_TOKEN')
SIGNING_SECRET = config('SIGNING_SECRET')
WEBHOOK_SECRET = config('WEBHOOK_SECRET')
PEERPP_BOT_UID = config('PEERPP_BOT_UID')
EVENT_ENDPOINT = '/slack/events'
PROJECT_NAMES = list(get_projects().values())
PROJECTS = get_projects()

# number of seconds to keep the evaluation locks in cache
# as to not send a (slow) request to intra very time a moderator lists the possible peer++ evals
GET_EVALUATION_LOCKS_TTL = 5 * 60

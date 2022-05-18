from typing import List, Set, Dict, Tuple, Optional
import os
from decouple import config


def get_projects() -> Dict[str, str]:
	projects = dict()
	with open("project_ids", "r+") as projects_f:
		lines = projects_f.readlines()
	for line in lines:
		project_name, project_id = line.strip().split('=')
		projects[project_name] = project_id
	return projects


CAMPUS_ID = 14
CURSUS_ID = 21
SLACK_TOKEN = config('SLACK_TOKEN')
SIGNING_SECRET = config('SIGNING_SECRET')
WEBHOOK_SECRET = config('WEBHOOK_SECRET')
PEERPP_BOT_UID = config('PEERPP_BOT_UID')
PEERPP_GROUP_ID = config('PEERPP_GROUP_ID')
EVENT_ENDPOINT = '/slack/events'

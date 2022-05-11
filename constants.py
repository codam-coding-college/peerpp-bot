from typing import List, Set, Dict, Tuple, Optional
import os
from decouple import config


def get_projects() -> Dict[str, int]:
	projects = dict()
	with open("project_ids", "r+") as projects_f:
		lines = projects_f.readlines()
	for line in lines:
		project_name, project_id = line.strip().split('=')
		projects[project_name] = int(project_id)
	return projects


CAMPUS_ID = 14
SLACK_TOKEN = config('SLACK_TOKEN')
SIGNING_SECRET = config('SIGNING_SECRET')
WEBHOOK_SECRET = config('WEBHOOK_SECRET')
EVENT_ENDPOINT = '/slack/events'
PROJECT_NAMES = list(get_projects().keys())

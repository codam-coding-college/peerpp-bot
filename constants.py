from typing import List, Set, Dict, Tuple, Optional
import os
from dotenv import load_dotenv


def get_projects() -> Dict[str, str]:
	projects = dict()
	with open("project_ids", "r+") as projects_f:
		lines = projects_f.readlines()
	for line in lines:
		project_name, project_id = line.strip().split('=')
		projects[project_name] = project_id
	return projects


CAMPUS_ID = 14
load_dotenv(dotenv_path='.env')
SLACK_TOKEN = os.environ['SLACK_TOKEN']
SLACK_EVENTS_TOKEN = os.environ['SLACK_EVENTS_TOKEN']

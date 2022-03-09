from typing import List, Set, Dict, Tuple, Optional


def get_projects() -> Dict[str, str]:
	projects = dict()
	with open("project_ids", "r+") as projects_f:
		lines = projects_f.readlines()
	for line in lines:
		project_name, project_id = line.strip().split('=')
		projects[project_name] = project_id
	return projects


campus_id = 14

from codamconnector import exchange
import json
from codamconnector.baseconnector import BaseConnector
from codamconnector.exchange import Exchange
from codampystd import List, Object, object
import codamconnector
from typing import DefaultDict, Optional
import requests
from urllib3 import response
import sys, getopt
from collections import Counter, defaultdict
import re
import random
from typing import List, Set, Dict, Tuple, Optional
from constants import get_projects, CAMPUS_ID

endpoint = codamconnector.IntraConnector(root="https://api.intra.42.fr/v2/")


# "begin_at": f"{begin_at}2017-11-27 09:00:00 UTC",
def make_scale_team(begin_at=None, scale_id=None, team_id=None, user_id=None):
	params = {"scale_team": {"begin_at": f"{begin_at} UTC", "scale_id": f"{scale_id}", "team_id": f"{team_id}", "user_id": f"{user_id}", "comment": "", "answers_attributes": "", "question_id": ""}}
	return json(params)


def probe(project_id, campus_id):
	page_number = 1
	url_last = None
	# exchange = get_exchange(f"projects/{project_id}/scale_teams?filter[campus_id]={campus_id}")
	result_probe = []
	list_students = []
	i = 0
	while 1:
		exchange = codamconnector.Exchange(f"projects/{project_id}/scale_teams?filter[campus_id]={campus_id}&page[number]={page_number}&page[size]=100&range[created_at]=2021-01-11,2021-12-17")
		endpoint.get(exchange)
		if len(exchange.result) == 0:
			break

		result_probe += list(exchange.result)
		page_number += 1
		# numbers = re.findall(r"\[([A-Za-z0-9_]+)\]", str(exchange.response))
		# numbers = re.sub(r'[\[\]!\']', '', str(numbers))
		# entry.correcteds[0].login == "nico_codam" and
		for entry in exchange.result:
			if str(entry.team.status) != "finished":
				if hasattr(entry.truant, 'login') == False:
					# print(entry.truant)
					# print(entry)
					# print("\n--------------------------------\n")
					list_students.append(entry.correcteds[0].login)
		i += 1
	return list(set(list_students)), Counter(list_students)


def save_as_json(target_list, project_name=""):
	with open(f"eval_status_{project_name}.json", "w+") as target_list_f:
		json.dump(target_list, target_list_f, indent=4)
	return


def main(project_name: str, intra_name: str) -> Tuple[bool, str, str]:
	projects = get_projects()
	try:
		students_list, counter_list_students = probe(projects[project_name], CAMPUS_ID)
		i = 0
		target_list = []
		while (i < len(students_list)):
			target = {"student_id": students_list[i], "eval_count": counter_list_students[students_list[i]], "project_name": project_name}
			target_list += [target]
			i += 1
		save_as_json(target_list, project_name=project_name)

		selection_list = []
		for target in target_list:
			if target["eval_count"] == 2:
				selection_list += [target]

		random_target = random.choice(selection_list)
		# CREATE SCALETEAM HERE
		# evaluator_intra WITH RANDOM_TARGET['student_id']
		exchange = codamconnector.Exchange(f"users/{random_target['student_id']}")
		endpoint.get(exchange)
		return True, exchange.result.email, random_target['student_id']
	except:
		print("INTERNAL ERROR HAS OCCURRED IN : GET_TARGET_PPP")
		return False, '', ''


if __name__ == '__main__':
	if len(sys.argv) != 2:
		print("Invalid args\nFormat: [project_name]\n")
		exit()
	project_name = sys.argv[1]
	projects = get_projects()
	if not project_name in projects.keys():
		print("ERROR, INVALID PROJECT_NAME")
		exit()
	main(project_name)

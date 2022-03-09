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

campus_id = 14
codam_id = 14
# project_session_id =3300
# user_id ="nico_codam"
# project_id =2009
# project_name="so_long"
# project_id =1314
# project_name="libft"
endpoint_ = codamconnector.IntraConnector(root="https://api.intra.42.fr/v2/")


def get_exchange(request_string, optional=None):
	exchange = codamconnector.Exchange(url=request_string, body=optional)
	return exchange


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
		exchange = get_exchange(f"projects/{project_id}/scale_teams?filter[campus_id]={campus_id}&page[number]={page_number}&page[size]=100&range[created_at]=2021-01-11,2021-12-17")
		endpoint_.get(exchange)
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


# CURSUS_ID = 21
def parse_projects() -> Dict[str, str]:
	projects = dict()
	with open("project_ids", "r+") as projects_f:
		lines = projects_f.readlines()
	for line in lines:
		project_name, project_id = line.strip().split('=')
		projects[project_name] = project_id
	return projects


def main_(argv=None, evaluator_intra=0, external=False, project_name=''):
	try:
		projects = parse_projects()
		if external == False:
			argc = len(sys.argv)
			if argc != 2:
				print("Invalid args\nFormat: [project_name]\n")
				if external == False:
					exit()
			# name of the project
			project_name = sys.argv[1]
			if not project_name in projects.keys():
				print("ERROR, INVALID PROJECT_NAME")
				return (False)
			project_id = projects[project_name]
		else:
			if project_name in projects.keys():
				project_id = projects[project_name]
			else:
				print("ERROR: INVALID PROJECT NAME")
				return (False)
		students_list, counter_list_students = probe(project_id, 14)
		i = 0
		len_list = len(students_list)
		target_list = []
		while (i < len_list):
			# print(f"Student id : {students_list[i]}\neval count : {counter_list_students[students_list[i]]}")
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
		exchange = get_exchange(f"users/{random_target['student_id']}")
		endpoint_.get(exchange)
		if external == True:
			return (True, exchange.result.email)
		else:
			print(exchange.result.email, random_target['student_id'])
			return
	except:
		print("INTERNAL ERROR HAS OCCURRED IN : GET_TARGET_PPP")
		return False
		#  gets lists of students for specified project.
		# f.e list["user1", "user2", "user3"]
		# Counter list students is a dictionary, that gets the amount of occurrences of IDs.
		# To count the eval count.


if __name__ == '__main__':
	main_(sys.argv)

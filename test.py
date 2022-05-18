from flask import Flask, request
from constants import CURSUS_ID, WEBHOOK_SECRET, PEERPP_BOT_UID
import codamconnector
import time
import json
from datetime import timezone, datetime, timedelta

endpoint = codamconnector.IntraConnector()
app = Flask(__name__)


def debug_write(id, contents):
	f = open(f"temp/{id}_{time.time()}.json", 'w')
	f.write(contents)
	f.close()


def get_user(user_id):
	exchange = codamconnector.Exchange(f"users/{user_id}")
	endpoint.get(exchange)
	debug_write(f"user_{user_id}", str(exchange.result))
	return exchange.result


def get_cursus_from_user(cursus_id, cursus_users):
	for cursus_user in cursus_users:
		if cursus_user.cursus_id == cursus_id:
			return cursus_user


def get_user_level(user):
	cursus = get_cursus_from_user(CURSUS_ID, user.cursus_users)
	if cursus:
		return cursus.level
	else:
		return -42


def get_evals(project_id, scale_id, team_id):
	exchange = codamconnector.Exchange(f"projects/{project_id}/scale_teams?filter[scale_id]={scale_id}&filter[team_id]={team_id}")
	endpoint.get(exchange)
	debug_write("scaleteams", str(exchange.result))
	return exchange.result


def peerpp_eval_required(evaled_user_level, evals):
	if len(evals) == 2:
		# check if past evals were of high standard
		one_high_standard = False
		for eval in evals:
			if eval.final_mark is None:
				print("Not all evals are done yet for this project (a final_mark is missing)")
				return False
			# TODO: check if corrector element exists in eval. Can be missing if user gave up on a project
			user = get_user(eval.corrector.id)
			level = get_user_level(user)
			print(f"LEVELS evaluator: {level}, evaluated: {evaled_user_level}")
			if level == -42:
				print(f"Could not find level of user {user.login}. Maybe they're not attending the cursus with id {CURSUS_ID}?")
				return False

			# No peer++ eval is necessary if the level of the evaluator is 4 levels higher than the evaluatee
			if level - 4 >= evaled_user_level:
				one_high_standard = True
				break
		return not one_high_standard
	else:
		print('Not yet 2 evals done. Skipping peer++ eval planning')


def book_placeholder_eval(scale_id, team_id):
	next_week = datetime.now() + timedelta(days=7)
	scale_team = {"scale_team": {"begin_at": next_week.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:00 %Z'), "scale_id": str(scale_id), "team_id": str(team_id), "user_id": PEERPP_BOT_UID}}
	json_body = json.dumps(scale_team)
	exchange = codamconnector.Exchange(f"scale_teams/multiple_create", body=json_body)
	endpoint.post(exchange)
	debug_write("booking", str(exchange.result))
	return exchange.result


@app.route('/webhook', methods=['POST'])
def whook():
	print("Webhook fired")
	f = open(f"temp/request_{time.time()}.txt", 'w')
	f.write(f"REQUEST AT TIMESTAMP {time.time()}\n\nHEADERS:\n{str(request.headers)}\nBODY:{str(request.data)}")
	f.close()
	if not 'X-Secret' in request.headers:
		return 'X-Secret header missing', 400
	if request.headers['X-Secret'] != WEBHOOK_SECRET:
		return 'X-Secret header incorrect', 412
	if request.content_type != 'application/json':
		return 'Content-Type should be application/json', 400
	body = request.get_json(force=True)
	debug_write("body", json.dumps(body))
	evals = get_evals(body['team']['project_id'], body['scale']['id'], body['team']['id'])
	if len(evals) > 0:
		evaled_user = get_user(evals[0].correcteds[0].id)
		evaled_user_level = get_user_level(evaled_user)
		print(f"{time.time()} | Checking if peer++ eval is required for team {body['team']['name']}")
		if peerpp_eval_required(evaled_user_level, evals):
			print("A peer++ eval is required")
			# book_placeholder_eval(body['scale']['id'], body['team']['id'])
			return 'Peer++ evaluation booked', 201
		else:
			print("No peer++ evaluation required")
			return 'No peer++ evaluation required', 204
	else:
		print("0 evaluations have occurred yet after a webhook fire. This should never happen")
		return 'Internal Server Error', 500


app.run(debug=True, port=5000, host='0.0.0.0')

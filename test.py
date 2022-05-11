from flask import Flask, request
from constants import CURSUS_ID, WEBHOOK_SECRET
import codamconnector
import time

endpoint = codamconnector.IntraConnector()
app = Flask(__name__)


def debug_write(id, contents):
	f = open(f"temp/{id}_{time.time()}.json", 'w', 'w')
	f.write(contents)
	f.close()


def get_user(user_id):
	exchange = codamconnector.Exchange(f"users/{user_id}")
	endpoint.get(exchange)
	debug_write("user_{user_id}", str(exchange.result))
	return exchange.result


def get_cursus_from_user(cursus_id, cursus_users):
	for cursus_user in cursus_users:
		if cursus_user['cursus_id'] == cursus_id:
			return cursus_user


def get_user_level(user):
	cursus = get_cursus_from_user(CURSUS_ID, user['cursus_users'])
	if cursus:
		return cursus['level']
	else:
		return 42


def get_evals(project_id, scale_id, team_id):
	exchange = codamconnector.Exchange(f"projects/{project_id}/scale_teams?filter[scale_id]={scale_id}&filter[team_id]={team_id}")
	endpoint.get(exchange)
	debug_write("scaleteams", str(exchange.result))
	return exchange.result


def peerpp_eval_required(evaled_user_level, evals):
	if len(evals) == 2:
		# check if past evals were of high standard
		highstandard = True
		for eval in evals:
			user = get_user(eval['corrector']['id'])
			level = get_user_level(user)
			if level - 4 < evaled_user_level:
				highstandard = False
				break
		return highstandard
	else:
		print('Not yet 2 evals done. Skipping peer++ eval planning')


@app.route('/webhook')
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
	debug_write("body", str(body))
	evals = get_evals(body['team']['project_id'], body['scale']['id'], body['team']['id'])
	if len(evals) > 0:
		evaled_user = get_user(evals[0]['correcteds'][0]['id'])
		evaled_user_level = get_user_level(evaled_user)
		if peerpp_eval_required(evaled_user_level, evals):
			print("A peer++ eval is required")
		else:
			print("No peer++ evaluation required")
	else:
		print("0 evaluations have occurred yet after a webhook fire. This should never happen")


def test():
	print("Test function running")
	exchange = codamconnector.Exchange(f"projects/1331/scale_teams?filter[scale_id]=12719&filter[team_id]=4087687")
	endpoint.get(exchange)
	debug_write("test", str(exchange.result))


# test()

app.run(debug=True, port=5000, host='0.0.0.0')

from flask import Flask, request
from constants import WEBHOOK_SECRET
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
	return (exchange.result)


def get_evals(project_id, scale_id, team_id):
	exchange = codamconnector.Exchange(f"projects/{project_id}/scale_teams?filter[scale_id]={scale_id}&filter[team_id]={team_id}")
	endpoint.get(exchange)
	debug_write("scaleteams", str(exchange.result))
	if len(exchange.result) == 2:
		# check if past evals were of high standard
		print('2 evals done')
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
	get_evals(body['team']['project_id'], body['scale']['id'], body['team']['id'])


def test():
	print("Test function running")
	exchange = codamconnector.Exchange(f"projects/1331/scale_teams?filter[scale_id]=12719&filter[team_id]=4087687")
	endpoint.get(exchange)
	debug_write("test", str(exchange.result))


# test()

app.run(debug=True, port=5000, host='0.0.0.0')
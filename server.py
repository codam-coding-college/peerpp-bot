from flask import Flask, request
import codamconnector
from useful.logger import log_create, log_close, get_dt
from creator.hook_handler import hook_handler, body_handler
from constants import WEBHOOK_SECRET

endpoint = codamconnector.IntraConnector()
app = Flask("Peer++ Webhook Server")


# Check if header is missing or incorrect, return False if everything is OK
def headers_incorrect(request):
	if not 'X-Delivery' in request.headers:
		return 'X-Delivery header missing'
	if not 'X-Secret' in request.headers:
		return 'X-Secret header missing'
	if request.content_type != 'application/json':
		return 'Content-Type is not application/json'
	return False


@app.route('/webhook', methods=['POST'])
def whook():
	header_failure_point = headers_incorrect(request)
	if header_failure_point:
		print(f"Warning: status code 400 ({header_failure_point}) for a request at {get_dt()} from IP {request.remote_addr}")
		return header_failure_point, 400

	# Check for X-Secret header in request: should equal to the webhook secret given by Intra
	if request.headers['X-Secret'] != WEBHOOK_SECRET:
		print(f"Warning: status code 412 (X-Secret header incorrect) for a request at {get_dt()} from IP {request.remote_addr}")
		return 'X-Secret header incorrect', 412

	# Create log file (for logging (obviously))
	log_file = log_create(request.headers['X-Delivery'])

	# Accept and handle the request
	body = hook_handler(log_file, request)
	if not body:
		return 'Malformed JSON received', 400

	# Handle the parsed JSON body
	peerpp_eval_planned = body_handler(endpoint, log_file, body)

	# Close log and send response
	log_close(log_file)
	if peerpp_eval_planned:
		return 'A peer++ evaluation placeholder has been created', 201
	return 'No peer++ evaluation is required at this time', 204


app.run(debug=True, port=5000, host='0.0.0.0')

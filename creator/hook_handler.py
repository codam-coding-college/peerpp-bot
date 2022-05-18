from useful.logger import log_announce, log_close, log_print, log_print_json
from useful.projects import get_evals
from useful.users import get_user, get_user_level
from .eval_requirements import peerpp_eval_required


# Returns True if peer++ eval has been planned, False if not
def body_handler(endpoint, log_file, body):
	evals = get_evals(endpoint, log_file, body['team']['project_id'], body['scale']['id'], body['team']['id'])
	if len(evals) > 0:
		log_print(log_file, f"Checking if peer++ eval is required for team {body['team']['id']}...")
		evaled_user = get_user(endpoint, evals[0].correcteds[0].id)
		evaled_user_level = get_user_level(evaled_user)
		if peerpp_eval_required(endpoint, log_file, evaled_user_level, evals):
			#TODO: plan evaluation
			print("Evaluation should be planned")
			return True
		return False
	else:
		return False


def hook_handler(log_file, request):
	try:
		body = request.get_json(force=True)
	except:
		log_close(log_file, msg="Malformed JSON received")
		return None
	log_announce(log_file, "Request body")
	log_print_json(log_file, body)
	return body

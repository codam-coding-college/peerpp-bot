from useful.logger import log_print
from useful.users import get_user, get_user_level
from constants import CURSUS_ID

def peerpp_eval_required(endpoint, log_file, evaled_user_level, evals):
	# Only check if a peer++ evaluation is required if the second-to-last evaluation has been completed
	if len(evals) != 2:
		log_print(log_file, 'Not at the second-to-last evaluation for this project, so not requiring a peer++ evaluation at this time')
		return False

	# Go over every previous evaluation and try to determine the quality
	for eval in evals:
		# Get the user object for the corrector
		try:
			corrector = get_user(endpoint, eval.corrector.id)
		except:
			log_print(log_file, 'No corrector for evaluation, student probably gave up on the project')
			return False

		# Get the corrector's level
		corrector_level = get_user_level(corrector)
		if corrector_level == -42:
			log_print(log_file, f"Could not find level of corrector {corrector.login}. Maybe they're not attending the cursus with id {CURSUS_ID}?")
			continue

		# no peer++ eval is necessary if the level of the evaluator is 4 levels higher than the evaluatee
		if corrector_level - 4 >= evaled_user_level:
			return False

	log_print(log_file, f"A peer++ eval is required")
	return True

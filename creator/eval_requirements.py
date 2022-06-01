from useful.logger import log_print
from useful.users import get_user, get_user_level
from constants import CURSUS_ID

def peerpp_eval_required(endpoint, log_file, evaled_user_level, evals):
	amount_evals_done = len(evals)
	if amount_evals_done == 0:
		log_print(log_file, 'Error: length of evals array is 0')
		return False

	# Only check if a peer++ evaluation is required if the second-to-last evaluation has been completed
	# Get amount of evals required from the last one (if the amount has been changed during hand-in of the project,
	# this eval is the last one done, so the number will likely be most up-to-date)
	amount_evals_required = evals[-1].scale.correction_number
	log_print(log_file, f"{amount_evals_required} evals are required, {amount_evals_done} have been done/created")
	if amount_evals_done != amount_evals_required - 1:
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
			log_print(log_file, f"Corrector {corrector.login} had a high enough level, so no need for a peer++ evaluation")
			return False

	log_print(log_file, 'A peer++ eval is required')
	return True

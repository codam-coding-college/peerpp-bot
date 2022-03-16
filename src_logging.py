from datetime import datetime
import json


def add_error_log(e):
	print(e)
	# with open("error_log.txt", "a") as error_log:
	# 	error_log.write(e)


def add_eval_history(evaluator: str, evaluee: str):
	history_entry = {"evaluator": evaluator, "evaluee": evaluee, "booked at": str(datetime.now())}
	with open("eval_history.json", "r+") as eval_history:
		try:
			data = json.load(eval_history)
			data["eval_history"].append(history_entry)
			eval_history.seek(0)
			json.dump(data, eval_history, indent=4)
		except:
			eval_history.seek(0)
			json.dump({"eval_history": [history_entry]}, eval_history)

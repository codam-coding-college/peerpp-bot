import json
from datetime import datetime

def get_dt_file():
	return datetime.now().strftime('%Y_%m_%d_%H_%M_%S')


def get_dt():
	return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def log_create(name):
	log_file = open(f"logs/{get_dt_file()}_{name}.txt", 'w')
	return log_file


def log_announce(log_file, msg):
	log_file.write(f"\n{str(msg).upper()}:")


def log_print(log_file, msg):
	log_file.write(f"\n{str(msg)}\n")


def log_print_json(log_file, json_obj):
	log_print(log_file, json.dumps(json_obj))


def log_close(log_file, msg=''):
	if msg:
		log_file.write(f"\n{str(msg)}\n")
	log_file.close()
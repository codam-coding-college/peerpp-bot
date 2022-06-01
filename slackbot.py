import slack
import ssl
import constants
import certifi
import re
from flask import Flask
from slackeventsapi import SlackEventAdapter
from typing import Dict
from get_evaluation_locks import get_evaluation_locks, delete_evaluation_lock
from useful.users import get_intra_uid_by_login
from useful.projects import book_eval
from useful.logger import log_create, log_print, log_announce, log_close, log_corrector_action
from datetime import datetime
import logging
import codamconnector

endpoint = codamconnector.IntraConnector()

webclient = slack.WebClient(token=constants.SLACK_TOKEN, ssl=ssl.create_default_context(cafile=certifi.where()))
app = Flask(__name__)
slack_event_adapter = SlackEventAdapter(constants.SIGNING_SECRET, constants.EVENT_ENDPOINT, app)

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)


def send_message(channel: str, text: str):
	try:
		webclient.chat_postMessage(channel=channel, text=text)
	except Exception as e:
		print(e)


def send_private_message(user_id, text: str):
	result = webclient.conversations_open(users=user_id)
	channel_id = result["channel"]["id"]
	send_message(channel=channel_id, text=text)
	webclient.conversations_close(token=constants.SLACK_TOKEN, channel=channel_id)


def get_display_name(user_id) -> str:
	response = webclient.users_info(user=user_id)
	user_info = response['user']
	return user_info['profile']['display_name']


class User:

	def __init__(self, slack_uid: str, intra_login: str, intra_uid: int):
		self.slack_uid = slack_uid
		self.intra_login = intra_login
		self.intra_uid = intra_uid


def get_user_from_slack_uid(slack_uid: str) -> User:
	try:
		response = webclient.users_info(user=slack_uid)
		intra_login = response['user']['profile']['display_name'].lower()
		intra_uid = get_intra_uid_by_login(endpoint, intra_login)
		if not intra_uid:
			return None
		return User(slack_uid, intra_login, intra_uid)

	except Exception as e:
		print(e)
		return None


def send_message_help(user_id):
	command_list: Tuple[str] = ('help', 'list_project_ids', 'book_evaluation [PROJECT_ID]')
	text = 'Available commands:\n'
	for command in command_list:
		text += f"- `{command}`\n"
	send_private_message(user_id, text)


def send_message_list_project_ids(user_id):
	text = 'Project IDs:\n'
	for name in constants.PROJECT_NAMES:
		text += f"- `{name}`\n"
	send_private_message(user_id, text)


def pretty_relative_time(time_diff_secs):
	# Each tuple in the sequence gives the name of a unit, and the number of
	# previous units which go into it.
	weeks_per_month = 365.242 / 12 / 7
	intervals = [('minute', 60), ('hour', 60), ('day', 24), ('week', 7), ('month', weeks_per_month), ('year', 12)]

	unit, number = 'second', abs(time_diff_secs)
	for new_unit, ratio in intervals:
		new_number = float(number) / ratio
		# If the new number is too small, don't go to the next unit.
		if new_number < 2:
			break
		unit, number = new_unit, new_number
	shown_num = int(number)
	return '{} {}'.format(shown_num, unit + ('' if shown_num == 1 else 's'))


# returns formatted string to send to user whey they want to list the available projects to be evaluated
# also does caching as to not overload the intra api
def get_possible_evaluations_text():
	projects = get_evaluation_locks()
	if len(projects) == 0:
		return 'No-one needs to be evaluated'

	longest_name_len = 0
	for project in projects:
		l = len(project['project_name'])
		if l > longest_name_len:
			longest_name_len = l

	text = 'Peer++ evaluations, highest priority first\n'
	text += 'Format: <project_name> <number_of_evaluations> <time_since_lock>\n'
	text += '```\n'
	for project in projects:
		name = project['project_name'].rjust(longest_name_len)
		users = str(len(project['scale_teams']))  #.rjust(2)
		time_locked = pretty_relative_time(datetime.now().timestamp() - project['scale_teams'][0]['created_at'])
		text += f"{name} | {users} users waiting, {time_locked} locked\n"

	text += '```'
	return text


def book_evaluation(corrector: User, project_name: str):
	send_private_message(corrector.slack_uid, f'Booking evaluation for {project_name}...')

	locks = get_evaluation_locks()
	for project in locks:
		if project['project_name'] == project_name:
			log_corrector_action(corrector.intra_login, f'requested peer++ eval for {project_name}')

			scale_team = project['scale_teams'][0]  # longest waiting one is first in list

			book_response = book_eval(endpoint, scale_team['scale_id'], scale_team['team_id'], corrector.intra_uid)
			if 'error' in book_response:
				log_corrector_action(corrector.intra_login, f'error on book_eval: {book_response}')
				return send_private_message(corrector.slack_uid, 'Evaluation booking failed')
			log_corrector_action(corrector.intra_login, 'booked evaluation')

			del_response = delete_evaluation_lock(scale_team['id'])  # delete the placeholder, has to happen after booking to prevent delete hook from booking again

			if del_response and 'error' in del_response:
				log_corrector_action(corrector.intra_login, f'error on delete_eval: {del_response}')
				return send_private_message(corrector.slack_uid, 'Deleting placeholder evaluation failed')

			log_corrector_action(corrector.intra_login, 'deleted evaluation')

			# TODO message to corrected users

			text = 'You will evaluate '
			for corrected in scale_team['correcteds']:
				text += f"@{corrected['login']} "
			text += f'on `{project_name}`'
			text += ', they have been sent a message on Slack letting them know you\'ve booked an eval, and asking them to contact you'
			send_private_message(corrector.slack_uid, text)

			return

	send_private_message(corrector.slack_uid, f'Could not book evaluation on {project_name}, no users available')


def respond_to_mention(text: str, corrector: User):
	# If the message is prefixed with "<@u036uss1tq8> " or something similar, delete that here, you would expect it to be <@peer_pp_bot> but no
	text_normalized = text.lower().strip()
	text_normalized = re.sub(r'^\<.+\> ', '', text_normalized)

	if text_normalized == 'list_project_ids':
		send_message_list_project_ids(corrector.slack_uid)
	elif text_normalized == 'help':
		send_message_help(corrector.slack_uid)
	elif text_normalized.startswith('book_evaluation'):
		project_name = re.sub(r'^book_evaluation *', '', text_normalized)
		if project_name == '':
			send_private_message(corrector.slack_uid, get_possible_evaluations_text())
		elif project_name in constants.PROJECT_NAMES:
			book_evaluation(corrector, project_name)
		else:
			send_private_message(corrector.slack_uid, f'Project "{project_name}" does not exist, run `help` for more info')
	else:
		send_private_message(corrector.slack_uid, f'Unexpected command "{text}"')
		send_message_help(corrector.slack_uid)


# Store received messages, so that when the same message comes in twice we can ignore it the second time
message_ids = []


# TODO: rate limiting
# Fires when bot receives private message
@slack_event_adapter.on('message')
def message(payLoad):
	event = payLoad.get('event', {})

	# Do not respond to it's own messages and other bots
	if event.get('bot_id'):
		return

	# delete received message history as to not grow the memory too much
	global message_ids
	if len(message_ids) > 10000:
		message_ids = message_ids[-10000:]

	# ignore message if we already received it
	if event.get('client_msg_id') in message_ids:
		return
	message_ids.append(event.get('client_msg_id'))

	# validate that we can match the slack user with the associated intra user
	slack_uid = event.get('user')
	evaluator = get_user_from_slack_uid(slack_uid)
	if not evaluator:
		return send_private_message(slack_uid, 'Your display name on slack does not match any intra user')

	# TODO: check if user is part of peer++ eval group

	respond_to_mention(event.get('text'), evaluator)


if __name__ == "__main__":
	app.run(debug=True)

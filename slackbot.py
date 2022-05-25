import slack
import ssl
import constants
import certifi
import re
from flask import Flask
from slackeventsapi import SlackEventAdapter
from typing import Dict
from get_evaluation_locks import get_evaluation_locks
from datetime import datetime

webclient = slack.WebClient(token=constants.SLACK_TOKEN, ssl=ssl.create_default_context(cafile=certifi.where()))
app = Flask(__name__)
slack_event_adapter = SlackEventAdapter(constants.SIGNING_SECRET, constants.EVENT_ENDPOINT, app)


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


def send_message_help(user_id):
	command_list: Tuple[str] = ('help', 'list_project_ids', 'list_evaluations', 'book_evaluation <PROJECT_ID>')
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


def send_message_possible_evaluations(user_id):
	projects = get_evaluation_locks()
	if len(projects) == 0:
		send_private_message(user_id, 'No-one needs to be evaluated')
		return

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
	send_private_message(user_id, text)


def book_evaluation(user_id, project_name: str):
	# TODO
	send_private_message(user_id, f'You will evaluate <username> on `{project_name}`')
	return


def respond_to_mention(text: str, user_id):
	# If the message is prefixed with "<@u036uss1tq8> " or something similar, delete that here, you would expect it to be <@peer_pp_bot> but no
	text_normalized = text.lower().strip()
	text_normalized = re.sub(r'^\<.+\> ', '', text_normalized)

	if text_normalized == 'list_project_ids':
		send_message_list_project_ids(user_id)
	elif text_normalized == 'help':
		send_message_help(user_id)
	elif text_normalized == 'list_evaluations':
		send_message_possible_evaluations(user_id)
	elif text_normalized.startswith('book_evaluation'):
		project_name = re.sub(r'^book_evaluation *', '', text_normalized)
		if project_name in constants.PROJECT_NAMES:
			book_evaluation(user_id, project_name)
		else:
			send_private_message(user_id, f'Project "{project_name}" does not exist, run `help` for more info')
	else:
		send_private_message(user_id, f'Unexpected command "{text}"')
		send_message_help(user_id)


# Fires when bot receives private message
@slack_event_adapter.on('message')
def message(payLoad):
	event = payLoad.get('event', {})
	channel_id = event.get('channel')
	user_id = event.get('user')
	text = event.get('text')
	display_name = get_display_name(user_id)

	# Do not respond to it's own messages
	if user_id == constants.PEERPP_SLACKBOT_ID:
		return

	if display_name == '':
		send_private_message(user_id, 'Error : your account has no display name')
		return

	respond_to_mention(text, user_id)


if __name__ == "__main__":
	app.run(debug=True)

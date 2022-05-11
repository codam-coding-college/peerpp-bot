import slack
import ssl
import constants
import certifi
import re
from flask import Flask
from slackeventsapi import SlackEventAdapter
from typing import List, Set, Dict, Tuple, Optional

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


def send_message_possible_evaluations(user_id):
	# TODO
	send_private_message(user_id, 'No-one needs to be evaluated')


def book_evaluation(user_id, project_name: str):
	# TODO
	send_private_message(user_id, f'You will evaluate <username> on `{project_name}`')
	return


def respond_to_mention(text: str, user_id):
	# If the message is prefixed with "<@u036uss1tq8> " or something similar, delete that here, you would expect it to be <@peer_pp_bot> but no
	text_normalized = re.sub(r'^\<.+\> ', '', text)
	text_normalized = text_normalized.lower().strip()

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


@slack_event_adapter.on('app_mention')
def message(payLoad):
	# if not channel_id == peerpp_channel_id: # TODO
	# 	return

	event = payLoad.get('event', {})
	channel_id = event.get('channel')
	user_id = event.get('user')
	text = event.get('text')
	display_name = get_display_name(user_id)

	if display_name == '':
		send_private_message(user_id, 'Error : your account has no display name')
		return

	respond_to_mention(text, user_id)


if __name__ == "__main__":
	app.run(debug=True)

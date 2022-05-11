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
	command_list: Tuple[str] = ('help', 'list_project_ids')
	text = 'Available commands:\n'
	text += '\n'.join(command_list)
	send_private_message(user_id, text)


def send_message_list_project_ids(user_id):
	text = 'Project IDs:\n'
	text += '\n'.join(constants.PROJECT_NAMES)
	send_private_message(user_id, text)


def respond_to_mention(text: str, user_id):
	# every message is prefixed with "<@u036uss1tq8> " or something similar, delete that here
	text_normalized = re.sub(r'^\<.+\> ', '', str(text))
	text_normalized = text_normalized.lower().strip()

	if text_normalized == 'list_project_ids':
		send_message_list_project_ids(user_id)
	else:
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

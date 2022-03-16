from flask.typing import ResponseReturnValue
import slack
import os
import time
from get_target_ppp import main_
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, request, Response
from slackeventsapi import SlackEventAdapter
from slack.errors import SlackApiError
from werkzeug.wrappers import response
from collections import defaultdict
from datetime import datetime
import json
import ssl
import certifi
from constants import get_projects, SLACK_TOKEN, SLACK_EVENTS_TOKEN, EVENT_ENDPOINT
from src_logging import add_error_log
from typing import List, Set, Dict, Tuple, Optional

ssl_context = ssl.create_default_context(cafile=certifi.where())
client = slack.WebClient(token=SLACK_TOKEN, ssl=ssl_context)
app = Flask(__name__)
slack_event_adapter = SlackEventAdapter(SLACK_EVENTS_TOKEN, EVENT_ENDPOINT, app)


class user_:

	def __init__(self, user_data=dict()):
		self.email = str()
		self.display_name = str()
		self.real_name = str()
		self.user_id = str()
		self.user_data = user_data


class slack_commands:

	def __init__(self):
		self.token: str = SLACK_TOKEN
		self.command_list: Tuple[str] = ('get eval [PROJECT NAME]', 'help', 'project list')

	def help(self, user=user_()) -> None:
		payload: str = 'Possible commands:\n'
		for cmd in self.command_list:
			payload += cmd + '\n'
		connector.send_private_message(user.user_id, payload)
		print('send message')

	def get_eval(self, display_name, evaluator_id, project_name):
		response, target_email = main_(evaluator_intra=display_name, external=True, project_name=project_name)
		if response == False:
			connector.send_message(text="Something went wrong, or no available candidates.")
		elif response == True:
			target_user = connector.create_user(target_email=target_email)
			# target_user = connector.create_user(target_email="zinobias@gmail.com")
		# main_(evaluator_intra=display_name, external=True, project_name=project_name)
		# return

		# send message to evaluator
		connector.send_private_message(target_user_id=evaluator_id, text=f"Hi {display_name}, You have an eval booked with: {target_user.display_name}")
		# send message to target
		connector.send_private_message(target_user_id=target_user.user_id, text=f"Hey {target_user.display_name}! You have been selected for a p++ eval!\n {display_name}\n with: {target_user.display_name}.\n\n If you run into any issues, please contact the evaluator or the Education assistant!")
		history_entry = {"evaluator": display_name, "evaluated": target_user.display_name, "booked at": str(datetime.now())}
		with open("eval_history.json", "r+") as eval_history:
			try:
				data = json.load(eval_history)
				data["eval_history"].append(history_entry)
				eval_history.seek(0)
				json.dump(data, eval_history, indent=4)
			except:
				eval_history.seek(0)
				json.dump({"eval_history": [history_entry]}, eval_history)

	def print_list(self, target_user_id):
		project_list = get_projects()
		payload = 'Hi, following are the available projects:\n'
		payload += '\n'.join(project_list)
		connector.send_private_message(target_user_id, text=payload)

	def parse_message(self, text: str, user_info=None):
		user = user_(user_info)
		user.display_name = user_info['profile']['display_name']
		user.user_id = user_info['id']

		# every message is prefixed with "<@u036uss1tq8> " or something similar, delete that here
		text_str = ''.join(str(text).split()[1:])
		text_str = text_str.lower().strip()
		if text_str == 'help':
			self.help(user=user)
		elif text_str.startswith('get eval'):
			self.get_eval(user.display_name, user.user_id, text_str.replace('get eval', ''))
		elif text_str == 'project list':
			self.print_list(user.user_id)
		else:
			connector.send_message(text='Invalid command, try \"help\"')


# Replace general with peerplusplus
class slack_connector:

	def __init__(self):
		self.client = client
		self.commands = slack_commands()
		self.token = os.environ["SLACK_TOKEN"]
		return

	def create_user(self, target_email=str()):
		user_info__ = client.users_lookupByEmail(email=target_email)
		new_user = user_(user_data=user_info__)
		new_user.display_name = user_info__["user"]["profile"]["display_name"]
		new_user.email = target_email
		new_user.real_name = user_info__["user"]["real_name"]
		new_user.user_id = user_info__["user"]["id"]
		return new_user

	def send_message(self, channel='#general', text=''):
		try:
			self.client.chat_postMessage(channel=channel, text=str(text))
		except Exception as e:
			self.client.chat_postMessage(channel=channel, text=str(text))
			add_error_log(e)
		return

	def send_private_message(self, target_user_id, text):
		result = client.conversations_open(users=target_user_id)
		target_channel_id = result["channel"]["id"]
		connector.send_message(channel=target_channel_id, text=text)
		result = client.conversations_close(token=self.token, channel=target_channel_id)

	def parse_message(self, text, user_info=None):
		self.commands.parse_message(text, user_info=user_info)


connector = slack_connector()


@slack_event_adapter.on('member_joined_channel')
def bot_message(payLoad):
	# set channel to peer++ channel id
	# peerpp_channel_id = [p++id]

	user_id = payLoad['event']['user']
	channel_id = payLoad['event']['channel']

	# if not channel_id == peerpp_channel_id:
	# 	return
	try:
		result = client.conversations_open(users=user_id)
		user_channel_id = result["channel"]["id"]
		connector.send_message(channel=user_channel_id, text="Hi welcome to the peerplusplus channel!\n I am the Bot you need when you want to do a P++eval :D !\n Type @[my_name] following a command in the peerplusplus channel to reach me, try \"help\"")
		client.conversations_close(token=os.environ["SLACK_TOKEN"], channel=user_channel_id)
	except Exception as e:
		add_error_log(e)


@slack_event_adapter.on('app_mention')
def message(payLoad):
	event = payLoad.get('event', {})
	channel_id = event.get('channel')
	user_id = event.get('user')
	text = event.get('text')
	# peer++channel_id = [peer++_channel_id]
	# TODO : once deployed, set channel_id to peer++ so it will only listen to that channel.
	# if not channel_id == peerpp_channel_id:
	# 	return
	try:
		response = client.users_info(user=user_id)
		user_info = response['user']
		if user_info['profile']['display_name'] == '':
			connector.send_message(channel=channel_id, text="Error : [Your account has no valid display_name]")
		else:
			connector.parse_message(text, user_info=user_info)
	except SlackApiError as e:
		error_message = e.response['error']
		connector.send_message(channel=channel_id, text=f'Something went wrong :C\n Error: [{error_message}]')
		add_error_log(e)


if __name__ == "__main__":
	app.run(debug=True)

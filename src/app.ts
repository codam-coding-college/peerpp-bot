import { app as slackApp } from './slack/slack'
import { app as webhookApp } from './webhook/webhook'
import util from 'util'

// set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

(async () => {
	await slackApp.start()
	await webhookApp.listen(8080)
	console.log('express started')
})()

import { app as slackApp } from './slack/slack'
import { app as webhookApp } from './webhook/webhook'

(async () => {
	await slackApp.start()
	await webhookApp.listen(8080)
	console.log('express started')
})()

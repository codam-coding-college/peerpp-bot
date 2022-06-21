import { app as slackApp }  from './slack'
import {app as webhookApp} from './webhook/webhook'

(async () => {
	await slackApp.start()
	await webhookApp.listen(5000)
	console.log('express started')
})()

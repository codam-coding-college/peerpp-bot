import { App, KnownEventFromType } from '@slack/bolt'
import { env } from './env'
import * as onMessage from './messageParsers';

const app = new App({
	signingSecret: env.SIGNING_SECRET,
	token: env.SLACK_TOKEN,
	socketMode: true,
	appToken: env.SLACK_APP_TOKEN,
});

function isDirect(message: KnownEventFromType<'message'>) {
	return message.channel === 'D0367EABH28' // TODO this can be done better
}

(async () => {
	await app.start()

	app.message(/.*/i, async ({ message, say }) => {
		if (!isDirect(message))
			return
		//@ts-ignore
		let text: string = message.text
		if (!text)
			return
		text = text.trim().toLowerCase()

		if (text.match(/^help/))
			onMessage.help(say)
		else if (text.match(/^list-projects/))
			onMessage.listProjectIds(say)
		else if (text.match(/^list-evaluations/))
			onMessage.listEvaluations(say)
		else if (text.match(/^book-evaluation/)) {
			const project: string = text.replace(/^book-evaluation/, '').trim()
			if (project.length == 0)
				onMessage.listProjectIds(say)
			else if (Object.keys(env.projectSlugs).includes(project))
				onMessage.bookEvaluation(say, text)
			else
				say(`project \`${project}\` not recognized, see help for more info`)
		}
		else
			say(`command \`${text}\` not recognized, see help for more info`)

	})

})()

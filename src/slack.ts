import { App, KnownEventFromType } from '@slack/bolt'
import { env } from './env'
import { getFullUser } from './getUser';
import * as onMessage from './messageParsers';
import { User, } from './types'

export const app = new App({
	token: env.SLACK_TOKEN,
	socketMode: true,
	appToken: env.SLACK_APP_TOKEN,
})

app.message(/.*/i, async ({ message, say, client, }) => {
	if (message.channel[0] !== 'D') // if not direct message
		return
	//@ts-ignore
	let text: string = message.text
	if (!text)
		return
	text = text.trim().toLowerCase()
	//@ts-ignore
	const slackUID = message!.user

	const user: User = await getFullUser({ slackUID })
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
	else if (text.match(/^whoami/)) {
		say(`\`\`\`${JSON.stringify(user, null, 4)}\`\`\``)
	}
	else
		say(`command \`${text}\` not recognized, see help for more info`)
})

import { App } from '@slack/bolt'
import { env } from './env'
import { getFullUser } from './getUser';
import * as onMessage from './messageParsers';
import { User, } from './types'

export const app = new App({
	token: env.SLACK_TOKEN,
	socketMode: true,
	appToken: env.SLACK_APP_TOKEN,
})

app.message(/.*/i, async ({ message, say, }) => {
	if (message.channel[0] !== 'D') // if not direct message
		return
	//@ts-ignore
	let text: string = message.text
	if (!text)
		return
	text = text.trim().toLowerCase()
	//@ts-ignore
	const slackUID = message!.user

	let user: User
	try {
		user = await getFullUser({ slackUID })
	} catch (err) {
		await await say(`Could not match your Slack ID to a Intra user`)
		return
	}
	if (text.match(/^help/))
		await onMessage.help(say)
	else if (text.match(/^list-projects/))
		await onMessage.listProjectIds(say)
	else if (text.match(/^list-evaluations/))
		await onMessage.listEvaluations(say)
	else if (text.match(/^book-evaluation/)) {
		const project: string = text.replace(/^book-evaluation/, '').trim()
		if (project.length == 0)
			await onMessage.listProjectIds(say)
		else if (env.projects.find((p) => p.slug == project))
			await onMessage.bookEvaluation(say, user, project)
		else
			await say(`project \`${project}\` not recognized, see help for more info`)
	}
	else if (text.match(/^whoami/)) {
		await say(`\`\`\`${JSON.stringify(user, null, 4)}\`\`\``)
	}
	else
		await say(`command \`${text}\` not recognized, see help for more info`)
})

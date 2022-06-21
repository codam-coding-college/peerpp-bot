import { App, SayFn } from '@slack/bolt'
import { env } from '../env'
import { getFullUser } from '../getUser';
import { Intra } from '../intra/intra';
import * as onMessage from './messageParsers';
import { User, } from '../types'

export const app = new App({
	token: env.SLACK_TOKEN,
	socketMode: true,
	appToken: env.SLACK_APP_TOKEN,
})

async function bookEvaluation(text: string, say: SayFn, corrector: User) {
	const [_, slug, correctorLogin] = text.split(' ')

	if (!slug) {
		await onMessage.listProjectIds(say)
		return
	}
	if (!env.projects.find((p) => p.slug === slug)) {
		await say(`Project \`${slug}\` not recognized, see help for more info`)
		return
	}
	if (correctorLogin?.length && !(await Intra.isPeerPPAdmin(corrector))) {
		await say(`You are not a peer++ admin, you can't book an evaluation for someone else`)
		return
	}

	if (correctorLogin) {
		try {
			corrector = await getFullUser({ intraLogin: correctorLogin })
		}
		catch (err) {
			await say(`Could not find user ${correctorLogin}`)
			return
		}
	}
	await onMessage.bookEvaluation(say, corrector, slug!)
}

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
	console.log(user)
	if (text.match(/^help/))
		await onMessage.help(say)
	else if (text.match(/^list-projects/))
		await onMessage.listProjectIds(say)
	else if (text.match(/^list-evaluations/))
		await onMessage.listEvaluations(say)
	else if (text.match(/^book-evaluation/))
		await bookEvaluation(text, say, user)
	else if (text.match(/^whoami/))
		await say(`\`\`\`${JSON.stringify(user, null, 4)}\`\`\``)

	else
		await say(`command \`${text}\` not recognized, see help for more info`)
})

import { SayFn } from "@slack/bolt";
import { ChatPostMessageArguments } from '@slack/web-api';
import { Intra } from "../intra/intra";
import { env } from '../env'
import prettyMilliseconds from 'pretty-ms'
import { User } from "../types";
import { getFullUser } from "../getUser";
import { app } from "./slack";
import { log } from "../log";


export async function help(say: SayFn) {
	const text = `\`\`\`
help                                              show this help
list-projects                                     list all projects which a peer++ evaluator can evaluate
list-evaluations                                  list all evaluations that were locked by the peer++ bot
book-evaluation [PROJECT_SLUG] [CORRECTOR_LOGIN]  book an evaluation for a project
                                                      [PROJECT_SLUG]:    (optional) the project slug of the project you want to evaluate
                                                      [CORRECTOR_LOGIN]: (optional, restricted) book an evaluation for someone else
whoami                                            show who this bot thinks you are
\`\`\``
	await say(text)
}

export async function listProjectIds(say: SayFn) {
	let text = `Possible projects to evaluate:\n`
	for (const project of env.projects)
		text += `- \`${project.slug}\`\n`
	await say(text)
}

export function highestPriorityScaleTeam(scaleTeams: Intra.ScaleTeam[]): Intra.ScaleTeam {
	let shortestAgo = Date.now()
	let best: Intra.ScaleTeam | null = null

	for (const scaleTeam of scaleTeams) {
		if (scaleTeam.createdAt.getTime() < shortestAgo) {
			shortestAgo = scaleTeam.createdAt.getTime()
			best = scaleTeam
		}
	}

	return best as Intra.ScaleTeam // TODO: this is pretty unsafe
}

function countProjects(locks: Intra.ScaleTeam[]) {
	const count: { [key: string]: { teamsN: number, createdAt: Date } } = {}
	for (const lock of locks) {
		if (!count[lock.projectSlug])
			count[lock.projectSlug] = { teamsN: 0, createdAt: new Date() }
		count[lock.projectSlug]!.teamsN++
		if (lock.createdAt.getTime() < count[lock.projectSlug]!.createdAt.getTime())
			count[lock.projectSlug]!.createdAt = lock.createdAt
	}
	return count
}

export async function listEvaluations(say: SayFn) {
	await say('Getting evaluation locks, this can take more than 10 seconds...')
	const locks = await Intra.getEvaluationLocks()
	if (locks.length == 0) {
		await say('No-one needs to be evaluated')
		return
	}
	locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

	const longestName: number = Math.max(...locks.map((lock: Intra.ScaleTeam) => lock.projectSlug.length))

	let text = 'Peer++ evaluations, highest priority first\n'
	text += 'Format: <project_name> <number_of_evaluations> <time_since_lock>\n'
	text += '```\n'

	const count = countProjects(locks)
	for (const key in count) {
		const name = key.padEnd(longestName, ' ')
		const nUsers = count[key]!.teamsN
		const timeLocked = prettyMilliseconds(Date.now() - count[key]!.createdAt.getTime(), { verbose: true, unitCount: 1 })

		text += `${name} | ${nUsers} teams waiting, ${timeLocked} locked\n`
	}
	text += '```'
	await say(text)
}

async function sendYouWillBeEvaluatedMsg(corrected: User, corrector: User, projectSlug: string): Promise<void> {
	const opt: ChatPostMessageArguments = {
		channel: corrected.slackUID,
		text: `You will be evaluated by ${corrector.intraLogin} on your \`${projectSlug}\`\nContact them to set a date for the evaluation`,
	}
	const response = await app.client.chat.postMessage(opt)
	if (!response.ok)
		throw new Error(response.error)
}

export async function bookEvaluation(say: SayFn, corrector: User, projectSlug: string): Promise<void> {
	await say(`Requested peer++ eval by ${corrector.intraLogin} for \`${projectSlug}\`...`)
	const locks = (await Intra.getEvaluationLocks()).filter((lock: Intra.ScaleTeam) => lock.projectSlug === projectSlug)
	if (locks.length == 0) {
		await say(`No-one needs to be evaluated on \`${projectSlug}\``)
		return
	}
	const lock: Intra.ScaleTeam = highestPriorityScaleTeam(locks)
	await say(`Found a team to be evaluated, booking evaluation...`)

	// intra requires a eval to be minimum of 15 minutes in the future
	const startEval = new Date(Date.now() + 20 * 60 * 1000)
	await Intra.bookEval(lock.scaleID, lock.teamID, corrector.intraUID, startEval)
	await log(`Booked evaluation corrector: ${corrector.intraLogin}, correcteds ${lock.correcteds} on ${projectSlug}`)
	await Intra.api.delete(`/v2/scale_teams/${lock.id}`)
	await log(`Deleted evaluation lock ${JSON.stringify(lock)}`)

	let text = `You will evaluate team \`${lock.teamName}\`, consisting of: `
	const correcteds: User[] = await Promise.all(lock.correcteds.map(c => getFullUser(c)))
	for (const user of correcteds)
		text += `@${user.intraLogin} `
	text += `at ${startEval}` // TODO: timezone?
	text += `, they will be sent a message on Slack letting them know you've booked an eval, and asking them to contact you`
	await say(text)

	for (const user of correcteds)
		await sendYouWillBeEvaluatedMsg(user, corrector, lock.projectSlug)
}

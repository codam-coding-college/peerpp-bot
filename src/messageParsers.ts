import { SayFn } from "@slack/bolt";
import { Intra } from "./intra/intra";
import { env } from './env'
import prettyMilliseconds from 'pretty-ms'

export function help(say: SayFn) {
	const text = `
	Available commands:
	- \`help\`
	- \`list-project-ids\`
	- \`list-evaluations\`
	- \`book-evaluation [PROJECT_NAME]\`
	- \`whoami\`
	`
	say(text)
}

export function listProjectIds(say: SayFn) {
	const slugs = Object.values(env.projectSlugs)
	let text = `Possible projects to evaluate:\n`
	for (const slug of slugs)
		text += `- \`${slug}\`\n`
	say(text)
}


function highestPriorityScaleTeam(scaleTeams: Intra.ScaleTeam[]): Intra.ScaleTeam {
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

export async function listEvaluations(say: SayFn) {
	const locks = await Intra.getEvaluationLocks()
	if (locks.length == 0) {
		say('No-one needs to be evaluated')
		return
	}
	const longestName: number = Math.max(...locks.map(lock => lock.projectName.length))

	let text = 'Peer++ evaluations, highest priority first\n'
	text += 'Format: <project_name> <number_of_evaluations> <time_since_lock>\n'
	text += '```\n'
	for (const lock of locks) {
		const name = lock.projectName.padEnd(longestName, ' ')
		const nUsers = String(lock.scaleTeams.length)
		const scaleTeam = highestPriorityScaleTeam(lock.scaleTeams)
		const timeLocked = prettyMilliseconds(Date.now() - scaleTeam.createdAt.getTime(), { verbose: true, unitCount: 1 })

		text += `${name} | ${nUsers} users waiting, ${timeLocked} locked\n`
	}
	text += '```'
	say(text)
}

export function bookEvaluation(say: SayFn, projectName: string) {
	say('bookEvaluation ' + projectName)
}

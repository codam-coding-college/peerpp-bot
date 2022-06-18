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
	let text = `Possible projects to evaluate:\n`
	for (const project of env.projects)
		text += `- \`${project.slug}\`\n`
	say(text)
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

export async function listEvaluations(say: SayFn) {
	say('Getting evaluation locks, this can take more than 10 seconds...')
	const locks = await Intra.getEvaluationLocks()
	if (locks.length == 0) {
		say('No-one needs to be evaluated')
		return
	}
	locks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

	const longestName: number = Math.max(...locks.map((lock: Intra.ScaleTeam) => lock.projectSlug.length))

	let text = 'Peer++ evaluations, highest priority first\n'
	text += 'Format: <project_name> <number_of_evaluations> <time_since_lock>\n'
	text += '```\n'

	const count: { [key: string]: { teamsN: number, createdAt: Date } } = {}
	for (const lock of locks) {
		if (!count[lock.projectSlug])
			count[lock.projectSlug] = { teamsN: 0, createdAt: new Date() }
		count[lock.projectSlug]!.teamsN++
		if (lock.createdAt.getTime() < count[lock.projectSlug]!.createdAt.getTime())
			count[lock.projectSlug]!.createdAt = lock.createdAt
	}

	for (const key in count) {
		const name = key.padEnd(longestName, ' ')
		const nUsers = count[key]!.teamsN
		const timeLocked = prettyMilliseconds(Date.now() - count[key]!.createdAt.getTime(), { verbose: true, unitCount: 1 })

		text += `${name} | ${nUsers} teams waiting, ${timeLocked} locked\n`
	}
	text += '```'
	say(text)
}

export function bookEvaluation(say: SayFn, projectSlug: string) {
	say('bookEvaluation ' + projectSlug)

}

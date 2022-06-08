import { SayFn } from "@slack/bolt";
import { env } from './env'

export function help(say: SayFn) {
	const text = `
	Available commands:
	- \`help\`
	- \`list-project-ids\`
	- \`list-evaluations\`
	- \`book-evaluation [PROJECT_NAME]\`
	`
	say(text)
}

export function listProjectIds(say: SayFn) {
	const slugs = Object.keys(env.projectSlugs)
	let text = `Possible projects to evaluate:\n`
	for (const slug of slugs)
		text += `- \`${slug}\`\n`
	say(text)
}

export function listEvaluations(say: SayFn) {
	say('listPossibleEvaluations')
}

export function bookEvaluation(say: SayFn, projectName: string) {
	say('bookEvaluation ' + projectName)
}

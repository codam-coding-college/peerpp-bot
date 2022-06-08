import { SayFn } from "@slack/bolt";

export function help(say: SayFn) {
	say('help')
}

export function listProjectIds(say: SayFn) {
	say('listProjectIds')
}

export function listEvaluations(say: SayFn) {
	say('listPossibleEvaluations')
}

export function bookEvaluation(say: SayFn, projectName: string) {
	say('bookEvaluation ' + projectName)
}

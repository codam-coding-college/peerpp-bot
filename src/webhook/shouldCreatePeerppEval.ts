import { logHook, logErr } from '../log'
import { getFullUser } from '../getUser'
import { Intra } from '../intra/intra'
import { IntraResponse } from '../types'
import { User } from '../types'
import { env } from '../env'


async function levelHighEnough(hook: IntraResponse.Webhook.Root, evals: IntraResponse.Evaluation[]): Promise<boolean> {
	try {
		const corrected: User = await getFullUser({ intraUID: hook.user.id, intraLogin: hook.user.login })
		for (const evalu of evals) {
			const corrector: User = await getFullUser({ intraUID: evalu.corrector.id, intraLogin: evalu.corrector.login })
			if (corrector.level - 2 > corrected.level) {
				await logHook(false, hook, `corrector ${corrector} level is high enough`)
				return true
			}
		}
		return false
	}
	catch (err) {
		logErr(`shouldCreatePeerppEval 2 | ${err}`)
		return true
	}
}

async function isFromWatchedCampus(user: User, hook: IntraResponse.Webhook.Root) {
	const isPart = env.WATCHED_CAMPUSES.includes(user.campusID)
	if (!isPart)
		await logHook(false, hook, `user ${JSON.stringify(user)} is not part of the watched campuses: ${env.WATCHED_CAMPUSES}`)
	return isPart
}

async function getUser(hook: IntraResponse.Webhook.Root): Promise<User | null> {
	try {
		return await getFullUser({ intraUID: hook.user.id, intraLogin: hook.user.login })
	}
	catch (err) {
		await logErr(`could not parse user from hook with err: ${err} hook: ${JSON.stringify(hook)}`)
		return null
	}
}

// Only check if a peer++ evaluation is required if the second-to-last evaluation has been completed
// Get amount of evals required from the last one (if the amount has been changed during hand-in of the project,
// this eval is the last one done, so the number will likely be most up-to-date)
export async function shouldCreatePeerppEval(hook: IntraResponse.Webhook.Root): Promise<boolean> {
	if (!env.projects.find(p => p.id === hook.project.id)) {
		await logHook(false, hook, `projectid ${hook.project.id} is not in the list of projects`)
		return false
	}

	let evals: IntraResponse.Evaluation[] = []
	try {
		evals = await Intra.getEvaluations(hook.team.project_id, hook.scale.id, hook.team.id)
	} catch (err) {
		logErr(`shouldCreatePeerppEval | ${err} | ${JSON.stringify(hook)}`)
		return false
	}
	if (evals?.length === 0) {
		await logHook(false, hook, `project has no evaluations completed`)
		return false
	}

	// ignore hooks coming from the peer++ bot itself
	if (hook.user.id === env.PEERPP_BOT_UID) {
		await logHook(false, hook, `hook is from peer++ bot`)
		return false
	}

	// TODO: check if previous evals were passed
	// TODO: ignore non codam student

	// only do check for peer++ eval if this is the second to last evaluation
	const nEvalsRequired = hook.scale.correction_number
	if (nEvalsRequired - 1 != evals.length) {
		await logHook(false, hook, `user did ${evals.length}, of the required ${nEvalsRequired} evals`)
		return false
	}

	const corrected: User | null = await getUser(hook)
	if (!corrected)
		return false
	if (!(await isFromWatchedCampus(corrected, hook)))
		return false

	// this should be the last check
	if (await levelHighEnough(hook, evals))
		return false

	await logHook(true, hook, `book an evaluation for: ${corrected.intraLogin} now`)
	return true
}

import { getFullUser } from "../getUser";
import { Intra } from "../intra/intra";
import { IntraResponse } from "../types";
import { User } from "../types";
import { env } from "../env";
import Logger from "../log";

// Helper functions
/* ************************************************************************** */

/**
 * Check if any of the previous evaluators had a high enough level.
 * @param hook The webhook.
 * @param evals The evaluations that took place.
 * @returns True if level is high enough else false.
 */
async function levelHighEnough(hook: IntraResponse.Webhook.Root, evals: IntraResponse.Evaluation[]): Promise<boolean> {
	try {
		const corrected: User = await getFullUser({
			intraUID: hook.user.id, 
			intraLogin: hook.user.login
		});
		
		for (const evaluation of evals) {
			const corrector: User = await getFullUser({ 
				intraUID: evaluation.corrector.id, 
				intraLogin: evaluation.corrector.login 
			});

			// Make sure to be at least 2 levels above.
			if (corrector.level - 2 > corrected.level) {
				await Logger.logHook( "ignored", hook, `corrector ${corrector} level is high enough`);
				return true;
			}
		}
		return false;
	} catch (err) {
		await Logger.logHook("error", hook, `levelHighEnough ${err}`);
		return true;
	}
}

/**
 * Is the given user from one of the watched campuses?
 * @param user The user to check.
 * @param hook The webhook.
 * @returns True if user is part of the watched campuses else false.
 */
async function isFromWatchedCampus(user: User, hook: IntraResponse.Webhook.Root) {
	const isPart = env.WATCHED_CAMPUSES.includes(user.campusID);

	if (!isPart)
		await Logger.logHook("ignored", hook, `user ${user.intraLogin} is not part of the watched campuses: ${env.WATCHED_CAMPUSES}`);
	return isPart;
}

/**
 * Get the user from the webhook response.
 * @param hook The webhook.
 * @returns The user data.
 */
async function getUser(hook: IntraResponse.Webhook.Root): Promise<User | null> {
	try { return await getFullUser({intraUID: hook.user.id, intraLogin: hook.user.login}); } 
	catch (err) {
		await Logger.logHook("error", hook, `could not parse user from hook with err: ${err} hook: ${JSON.stringify(hook.user.displayname)}`);
		return null;
	}
}

// Main function
/* ************************************************************************** */

/**
 * Checks wether a peer++ evaluation is required if the second-to-last evaluation has been completed.
 * 
 * Get amount of evals required from the last one (if the amount has been changed during hand-in of the project
 * this eval is the last one done, so the number will likely be most up-to-date).
 * 
 * @param hook The web hook response.
 * @returns True if required else false.
 */
export async function requiresEvaluation(hook: IntraResponse.Webhook.Root): Promise<boolean> {
	// Ignore hooks coming from the peer++ bot itself.
	
	if (hook.user == null) {
		await Logger.logHook("ignored", hook, `Missing evaluator, possibly missing evaluation`);
		return false;
	}
	if (hook.user.id === env.PEERPP_BOT_UID) {
		await Logger.logHook("ignored", hook, `Evaluator is Peer++ bot`);
		return false;
	}

	// TODO: Check if there are enough Peer++ evaluators to begin with.

	// Make sure the project is in the list.
	if (!env.projects.find((p) => p.id === hook.project.id)) {
		await Logger.logHook("ignored", hook, `project id ${hook.project.id} is not in the list of projects`);
		return false;
	}

	// Inspect the evaluations.
	let evals: IntraResponse.Evaluation[] = [];
	try {
		
		evals = await Intra.getEvaluations(hook.team.project_id, hook.scale.id, hook.team.id);
		console.log("Getting evaluations")
	} 
	catch (err) {
		Logger.err(`shouldCreatePeerppEval | ${err}`);
		return false;
	}
	if (evals?.length === 0) {
		await Logger.logHook("ignored", hook, `project has no evaluations completed`);
		return false;
	}

	// Only do check for peer++ eval if this is the second to last evaluation
	const nEvalsRequired = hook.scale.correction_number;
	if (nEvalsRequired - 1 != evals.length) {
		await Logger.logHook("ignored", hook, `user ${hook.user.login} did ${evals.length}, of the required ${nEvalsRequired} evals`);
		return false;
	}

	// TODO: Check if previous evals were passed
	
	const corrected: User | null = await getUser(hook);
	if (!corrected || !(await isFromWatchedCampus(corrected, hook)))
		return false;

	// TODO: Check additional things from the previous evaluations: Feedback rating, feedback length, evaluation duration, ...
	// For now this should be 'good enough'
	if (await levelHighEnough(hook, evals)) 
		return false;

	// Book the eval
	await Logger.logHook("required", hook, `book an evaluation for: ${corrected.intraLogin} now`);
	return true;
}

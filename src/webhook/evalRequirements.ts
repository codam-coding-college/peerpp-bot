import Logger from "../utils/log";
import { env } from "../utils/env";
import { Intra } from "../utils/intra/intra";
import { getFullUser } from "../utils/getUser";
import { IntraResponse, User } from "../utils/types";

// Helper functions
/* ************************************************************************** */

/**
 * Check if any of the previous evaluators had a high enough level.
 * @param evals The evaluations that took place.
 * @returns True if level is high enough else false.
 */
async function levelHighEnough(evals: IntraResponse.Evaluation[]): Promise<boolean> {
	try {
		for (const evaluation of evals) {
			const evaluator = await getFullUser({intraLogin: evaluation.corrector.login, intraUID: evaluation.corrector.id});
			
			for (const user of evaluation.correcteds) {
				const student = await getFullUser({intraLogin: user.login, intraUID: user.id});
	
				// If any user is was above 2 levels their evaluator, it should be fine.
				if (student.level + 2 > evaluator.level) 
					return true;
			};
		}
		return false;
	} catch (err) { // Intra most likely barfed.
		await Logger.err(`levelHighEnough ${err}`);
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
	if (!env.WATCHED_CAMPUSES.includes(user.campusID))
		await Logger.logHook("ignored", hook, `user ${user.intraLogin} is not part of the watched campuses: ${env.WATCHED_CAMPUSES}`);
	return true;
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
 * TODO: Check additional things from the previous evaluations: Feedback rating, feedback length, evaluation duration, ...
 * 
 * @param hook The web hook response.
 * @returns True if required else false.
 */
export async function requiresEvaluation(hook: IntraResponse.Webhook.Root): Promise<boolean> {
	// Ignore hooks coming from the peer++ bot itself.
	if (hook.user.id === env.PEERPP_BOT_UID) {
		await Logger.logHook("ignored", hook, `Evaluator is Peer++ bot`);
		return false;
	}
	// Make sure the project is in the list.
	if (!env.projects.find((p) => p.id === hook.project.id)) {
		await Logger.logHook("ignored", hook, `project id ${hook.project.id} is not in the list of projects`);
		return false;
	}
	// Ignore missing evaluations as they already failed the project.
	if (hook.user == null) {
		await Logger.logHook("ignored", hook, `Missing evaluator, possibly missing evaluation`);
		return false;
	}

	// Inspect the evaluations.
	let evals: IntraResponse.Evaluation[] = [];
	try { evals = await Intra.getEvaluations(hook.team.project_id, hook.scale.id, hook.team.id); } 
	catch (err) {
		Logger.err(`shouldCreatePeerppEval | ${err} | Something went wrong trying to fetch evals`);
		return false;
	}
	if (evals?.length === 0) {
		await Logger.logHook("ignored", hook, `project has no evaluations completed`);
		return false;
	}

	// Only do check for peer++ eval if this is the second to last evaluation
	const nEvalsRequired = hook.scale.correction_number;
	if (nEvalsRequired - 1 != evals.length) {
		await Logger.logHook("ignored", hook, `team ${hook.team.name} did ${evals.length}, of the required ${nEvalsRequired} evals`);
		return false;
	}

	// TODO: Don't book evals for already previously failed evaluations as its not necessary.
	// for now this is not a big deal. Students could still benefit from a Peer++ eval in a way.

	// for (let i = 0; i < evals.length; i++) {
	// 	const evaluation = evals[i]!;
	// 	console.log(JSON.stringify(evaluation.team));
	// 	// Evaluation is not finished yet, we wait for the webhook to fire again later when the scale is updated.
	// 	if (evaluation.team.validated == null) {
	// 		await Logger.logHook("ignored", hook, `team ${hook.team.name} is currently doing an evaluation`);
	// 		return false;
	// 	}
	// 	// They failed the evaluation, ignore them.
	// 	else if (evaluation.team.validated == false) {
	// 		await Logger.logHook("ignored", hook, `team ${hook.team.name} has failed an evaluation`);
	// 		return false;
	// 	}
	// }

	// Check the correctors campus to get an idea from where this eval is coming from.
	const corrector: User | null = await getUser(hook);
	if (!corrector || !(await isFromWatchedCampus(corrector, hook)))
		return false;

	if (await levelHighEnough(evals)) 
		return false;
	await Logger.logHook("required", hook, `book an evaluation for team: ${hook.team.id} now`);
	return true;
}

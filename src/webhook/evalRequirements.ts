import { env } from "../utils/env";
import { getFullUser } from "../utils/getUser";
import { Intra } from "../utils/intra/intra";
import Logger from "../utils/log";
import { IntraResponse, User } from "../utils/types";

/*============================================================================*/

export namespace Webhook {
	
	//===// Utilities //===//

	/**
	 * Checks wether any of the previous evaluators are of high enough level.
	 * @param hook The webhook response carrying the ScaleTeam.
	 * @returns True if the previous evaluators are of high enough level else false.
	 */
	const checkEvaluators = async (hook: IntraResponse.Webhook.Root, evals: IntraResponse.Evaluation[]) => {
		try {
			// Fetch team leader to compare to other evaluators.
			const user = hook.team.users.find((user) => user.leader === true);
			if (user === undefined)
				throw new Error(`No team leader for ${hook.team.id}`);

			const leader: User = await getFullUser({
				intraLogin: user.login,
				intraUID: user.id
			});
			
			// Compare to previous evaluators.
			for (const evaluation of evals) {
				const corrector: User = await getFullUser({
					intraLogin: evaluation.corrector.login, 
					intraUID: evaluation.corrector.id
				});

				if (leader.level + 2 < corrector.level)
					return false;
			}
			return true;
		} catch (error) {
			Logger.err(error);
			return true;
		}
	}

	//===// Functions //===//

	/**
	 * Checks wether the given ScaleTeam requires an evaluation.
	 * 
	 * TODO: Check additional things from the previous evaluations
	 * 
	 * @param hook The webhook response carrying the ScaleTeam.
	 * @returns True if required else false.
	 */
	export const requiresEvaluation = async (hook: IntraResponse.Webhook.Root) => {
		// Check user and project
		if (hook.user == null) {
			Logger.log("Ignored: ScaleTeam is a missing peer-evaluation one");
			return false;
		}
		if (hook.user.id == env.PEERPP_BOT_UID) {
			Logger.log("Ignored: ScaleTeam evaluator is the bot itself");
			return false;
		}
		if (!env.projects.find((p) => p.id === hook.project.id)) {
			Logger.log(`Ignored: ProjectID ${hook.project.id} is not in the list of projects`);
			return false;
		}

		// Inspect the evaluations.
		let evals: IntraResponse.Evaluation[] = [];
		try { evals = await Intra.getEvaluations(hook.team.project_id, hook.scale.id, hook.team.id); } 
		catch (error) {
			Logger.err(error);
			return false;
		}
		if (hook.scale.correction_number - 1 != evals.length) {
			Logger.log(`Ignored: ${hook.team.name} did ${evals.length} / ${hook.scale.correction_number} evaluations.`)
			return false;
		}
		// TODO: Don't book evals for already previously failed evaluations as its not necessary.
		if (!await checkEvaluators(hook, evals))
			return false;

		Logger.log(`Required: Team ${hook.team.name} requires a evaluation!`)
		return true;
	};
}

import { env } from "../utils/env";
import { getFullUser } from "../utils/getUser";
import { Intra } from "../utils/intra/intra";
import Logger from "../utils/log";
import { IntraResponse, User } from "../utils/types";

/*============================================================================*/

export namespace Webhook {
	
	//===// Utilities //===//

	/**
	 * Is the corrector of 
	 * @param hook 
	 * @returns True if an evaluation is required, false otherwise.
	 */
	const checkEvaluators = async (hook: IntraResponse.Webhook.Root, evals: IntraResponse.Evaluation[]) => {
		try {
			const corrector: User | null = await getFullUser({
				intraUID: hook.user.id, 
				intraLogin: hook.user.login
			});
			
			// Check if evaluation is from watched campus
			if (!env.WATCHED_CAMPUSES.includes(corrector.campusID)) {
				Logger.log("Ignored: Evaluation is not from watched campus");
				return true;
			}

			// Check previous evaluators and their levels.
			for (const evaluation of evals)
				for (const user of evaluation.correcteds) {
					const student = await getFullUser({intraLogin: user.login, intraUID: user.id});
					if (student.level + 2 < corrector.level) 
						return true;
				}

			return false;
		} catch (error) {
			Logger.err(error);
			return false;
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

// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { Config } from "../config";
import Intra from "../utils/intra";
import Logger from "../utils/logger";
import { IntraResponse, IntraWebhook } from "../utils/types";
import { getFullUser, User } from "../utils/user";

/*============================================================================*/

/**
 * Checks if the previous evaluators had a good enough level and if they did the
 * project.
 * 
 * Check should make sure that evaluators are EITHER of a high enough level
 * or that someone has at least done the project.
 * 
 * @param evaluations The evaluations of the project.
 * @return True if an evaluation is required, else false.
 */
export async function Evaluators(hook: IntraWebhook.Root, evaluations: Intra.ScaleTeam[], teamUsers: IntraResponse.TeamUser[]) {
	const leaderData = teamUsers.find(value => value.leader == true)!;

	let levels: number[] = [];
	let didProject: boolean = false;

	const leader = await getFullUser({ intraUID: leaderData.user_id });
	for (const evaluation of evaluations) {
		if (evaluation.corrector.intraUID == Config.botID) {
			Logger.log("Ignored: Bot already present for evaluation.");
			return false;
		}
		if (evaluation.finalMark != null && !await Intra.markIsPass(hook.project.id, evaluation.finalMark)) {
			Logger.log("Ignored: Previous evaluation was a fail.");
			return false
		}

		const corrector: User = await getFullUser(evaluation.corrector);
		didProject = await Intra.validatedProject(corrector.intraUID, hook.project.name);
		levels.push(corrector.level);
	}

	if (Math.max(...levels) >= leader.level + 2 || didProject) {
		Logger.log("Ignored: Team had a high level corrector or a corrector who did the project.")
		return false;
	}
	return true;
}
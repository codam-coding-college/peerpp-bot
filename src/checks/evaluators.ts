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
 * Checks whether the team's previous correctors were good enough, so that a Peer++
 * evaluator does not have to step in.
 *
 * A team is left alone when a corrector was EITHER of a high enough level
 * or had completed the project themselves.
 *
 * @param evaluations The evaluations the team already had for this project.
 * @return True if the team's final evaluation should be locked, else false.
 */
export async function PreviousCorrectors(hook: IntraWebhook.Root, evaluations: Intra.ScaleTeam[], teamUsers: IntraResponse.TeamUser[]) {
	const leaderData = teamUsers.find((value) => value.leader == true)!;

	let levels: number[] = [];
	let didProject: boolean = false;

	const leader = await getFullUser({ intraUID: leaderData.user_id });
	for (const evaluation of evaluations) {
		if (evaluation.corrector.intraUID == Config.botID) {
			Logger.log("Ignored: the bot is already the corrector of an evaluation.");
			return false;
		}
		if (evaluation.finalMark != null && !(await Intra.markIsPass(hook.project.id, evaluation.finalMark))) {
			Logger.log("Ignored: Previous evaluation was a fail.");
			return false;
		}

		const corrector: User = await getFullUser(evaluation.corrector);
		didProject = await Intra.validatedProject(corrector.intraUID, hook.project.name.toLowerCase());
		levels.push(corrector.level);
	}

	if (Math.max(...levels) >= leader.level + 2 || didProject) {
		Logger.log("Ignored: Team had a high level corrector or a corrector who did the project.");
		return false;
	}
	return true;
}

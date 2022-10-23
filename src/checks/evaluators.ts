// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { Config } from "../config";
import Intra from "../utils/intra";
import Logger from "../utils/logger";
import { IntraWebhook } from "../utils/types";
import { getFullUser, User } from "../utils/user";

/*============================================================================*/

/**
 * Checks if the previous evaluators had a good enough level and if they did the
 * project.
 * 
 * Check should make sure that evaluators are EITHER of a high enough level
 * or that someone has at least done the project.
 * 
 * @param evaluations 
 * @return True if check passed, false otherwise.
 */
export async function checkEvaluators(hook: IntraWebhook.Root, evaluations: Intra.ScaleTeam[]) {
	// NOTE (W2): Completely fucked up and weird endpoint btw.
	const teamResponse = await Intra.api.get(`/teams/${hook.team.id}/teams_users`)
	if (!teamResponse.ok)
		throw new Error(`Failed to get team_users: ${teamResponse.statusText}`);
	const leaderData = (await teamResponse.json() as any[]).find(value => value.leader == true);

	let levels: number[] = [];
	let didProject: boolean = false;

	const leader = await getFullUser({ intraLogin: leaderData.user.login, intraUID: leaderData.user.id });
	for (const evaluation of evaluations) {
		if (evaluation.corrector.intraUID == Config.botID) {
			Logger.log("Ignored: Bot already present for evaluation.");
			return true;
		}

		const corrector: User = await getFullUser(evaluation.corrector);
		didProject = await Intra.validatedProject(corrector.intraUID, hook.project.name);
		levels.push(corrector.level);
	}
	
	if (Math.max(...levels) >= leader.level + 2 || didProject)
		return true;
	return false;
}
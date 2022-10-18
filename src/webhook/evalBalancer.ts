import { Intra } from "../utils/intra/intra";
import { IntraResponse } from "../utils/types";

// This is temporarily here and will me migrated in its own application later

/*============================================================================*/

const CPPModules = [
    { id:1338, slug: "cpp-module-00"},
    { id:1339, slug: "cpp-module-01"},
    { id:1340, slug: "cpp-module-02"},
    { id:1341, slug: "cpp-module-03"},
    { id:1342, slug: "cpp-module-04"},
    { id:1343, slug: "cpp-module-05"},
    { id:1344, slug: "cpp-module-06"},
    { id:1345, slug: "cpp-module-07"},
    { id:1346, slug: "cpp-module-08"},
]

/*============================================================================*/

/**
 * 
 * @param userID The user ID.
 * @param correctionPoints The user's amount of evaluation points.
 * @param dollarPerPoint How much each point should give in alterian dollars
 * @returns 
 */
const trimExcessPoints = async (userID: number, correctionPoints: number, dollarPerPoint: number) => {
    const amountToDeduct = correctionPoints - 5;
    if (amountToDeduct > 0) {
        const userResponse = await Intra.api.delete(`/users/${userID}/correction_points/remove`, {
            "reason": "Correction point cap at 5 points.",
            "amount": amountToDeduct
        });
        if (!userResponse.ok)
            return console.log(`Failed to remove points from user: ${userResponse.statusText}`);

        const poolResponse = await Intra.api.post(`/pools/39/points/add`, { "points": amountToDeduct });
        if (!poolResponse.ok)
            return console.log(`Failed to add points to pool: ${poolResponse.statusText}`);
        await rewardDollars(userID, correctionPoints * dollarPerPoint, "Converting excess evaluation point(s) to dollars")
    }
}

/**
 * Gives n amount of dollars to a student via a transaction.
 * @param id The user ID, aka the one getting the dollars.
 * @param amount The amount of dollars to give.
 */
const rewardDollars = async (id: number, amount: number, reason: string) => {
    const body = {
        transaction: {
            user_id: id,
            value: amount,
            transactable_type: "Exchange",
            reason: reason
        }
    }

    const userResponse = await Intra.api.post(`/transactions`, body);
    if (!userResponse.ok)
        return console.log(`Failed to reward user: ${userResponse.statusText}`);
    console.log(`User rewarded with: ${amount} dollars`);
}

/*============================================================================*/

/**
 * Fires for: ScaleTeam - UpdateWebhook
 * 
 * Balance out the points for CPP Modules, that is the second evaluation gives back a point from the pool.
 * @param hook The Webhook response.
 */
export const balanceCPP = async (hook: IntraResponse.Webhook.Root) => {
    if (hook.user == null)
        return console.log("Ignored: ScaleTeam is a missing peer-evaluation one");
    if (!CPPModules.find((p) => p.id === hook.project.id))
        return console.log(`Requires no balance, not a CPP Module`);
    if (hook.filled_at === null)
        return console.log(`Evaluation not yet completed`);
    if (hook.scale.correction_number != 2) // NOTE (W2): OK so technically we should fetch the amount of corrections of this project and then check.
        return console.log(`No balance yet needed, only did 1 evaluation`);

    // Deduct point from pool.
    const poolResponse = await Intra.api.delete(`/pools/39/points/remove`, { "points": 1 });
    if (!poolResponse.ok)
		return console.log(`Failed to remove point from pool: ${poolResponse.statusText}`);

    // NOTE (W2): Thank intra scaleteam for not including evaluator ID, very much appreciated :)
    const teamResponse = await Intra.api.get(`/teams/${hook.team.id}/teams_users`)
    if (!teamResponse.ok)
        return console.log(`Failed to add point to user: ${teamResponse.statusText}`);
    const teamUsers = await teamResponse.json();

    // Give the user that point, in-case of CPP there will only be one user in the team.
    const userResponse = await Intra.api.post(`/users/${teamUsers[0].user.id}/correction_points/add`, {});
    if (!userResponse.ok)
        return console.log(`Failed to add point to user: ${userResponse.statusText}`);
    console.log(`Balanced evaluation points for CPP Module: ${hook.team.name}`);
}

/*============================================================================*/

/**
 * Fires for: ScaleTeam - Update Webhook
 * 
 * Deletes that one additional point from B2BR, adds one point to the pool.
 * 
 * @param hook The Webhook response.
 */
export const balanceB2BR = async (hook: IntraResponse.Webhook.Root) => {
    if (hook.user == null)
        return console.log("Ignored: ScaleTeam is a missing peer-evaluation one");
    if (hook.filled_at === null)
        return console.log(`Evaluation not yet completed`);
    if (hook.project.id === 1994) // B2BR ID
        return console.log(`Requires no balance, not B2BR`);
	if (hook.scale.correction_number != 3) // NOTE (W2): We should fetch the amount of corrections of this project here too.
		return console.log(`No balance yet needed, did not yet do 3 evaluations`);

    // Fetch team
    const teamResponse = await Intra.api.get(`/teams/${hook.team.id}/teams_users`)
    if (!teamResponse.ok)
        return console.log(`Failed to add point to user: ${teamResponse.statusText}`);
    const teamUsers = await teamResponse.json();

    // Remove that extra point, again this is a single project
    const userResponse = await Intra.api.delete(`/users/${teamUsers[0].user.id}/correction_points/remove`, {
        "reason": "B2BR correction, needed to balance out the pool inflation."
    });
    if (!userResponse.ok)
        return console.log(`Failed to remove point from user: ${userResponse.statusText}`);
    await rewardDollars(hook.user.id, 10, "Converting excess evaluation point(s) to dollars")

    // Add one point to the pool.
    const poolResponse = await Intra.api.post(`/pools/39/points/add`, { "points": 1 });
    if (!poolResponse.ok)
		return console.log(`Failed to add point from to: ${poolResponse.statusText}`);
}

/*============================================================================*/

/**
 * Fires for: ScaleTeam - Update webhook
 * 
 * Group evaluations deduct a point from each member, the one point of leader goes to evaluator.
 * However the remaining users point just gets nuked to oblivion.
 * 
 * Instead we add those extra points back to the pool.
 * If evaluator gets any additional points (like 2 for example), that point gets removed and converted.
 * 
 * So if evaluator gets 2 points, they only get 1 and the extra point is added back to the pool with them
 * being converted back to dollars.
 * 
 * @param hook The Webhook response.
 */
 export const balanceGroupPoints = async (hook: IntraResponse.Webhook.Root) => {
    if (hook.user == null)
        return console.log("ScaleTeam is a missing peer-evaluation");
    if (hook.filled_at === null)
        return console.log(`Evaluation not yet completed`);
    
    const teamResponse = await Intra.api.get(`/teams/${hook.team.id}/teams_users`)
    if (!teamResponse.ok)
        return console.log(`Failed get team: ${hook.team.name}: ${teamResponse.statusText}`);
    const teamUsers = await teamResponse.json();

    if (teamUsers.length == 1)
        return console.log(`Project is not a group project`);

    // Skip leader who's point was already transferred, add the nuked ones back to the pool.
    const poolResponse = await Intra.api.post(`/pools/39/points/add`, { "points": teamUsers.length - 1 });
    if (!poolResponse.ok)
        return console.log(`Failed to add points to pool: ${poolResponse.statusText}`);

    // Convert any extra points given to corrector to dollars, Inception of Things e.g: Gives 2 points.
    trimExcessPoints(hook.user.id, hook.user.correction_point, 10);
}

/**
 * Fires for: ???
 * 
 * Converts a given users excess 
 * 
 * @param hook The Webhook response.
 */
export const basicBalance = async (user: string | number) => {
    const userResponse = await Intra.api.get(`/users/${user}`);
	if (!userResponse.ok)
		return console.error(`Intra failed to get user: ${userResponse.statusText}`);
	const userData = await userResponse.json();

    await trimExcessPoints(userData.id, userData.correction_point, 10);
}

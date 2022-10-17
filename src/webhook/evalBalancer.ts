import Logger from "../utils/log";
import { Intra } from "../utils/intra/intra";
import { IntraResponse } from "../utils/types";

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
 * Balance out the points for CPP Modules, that is the second evaluation gives back a point
 * from the pool.
 * @param hook The Webhook response.
 */
export const balanceCPP = async (hook: IntraResponse.Webhook.Root) => {
    Logger.log(`Checking if project: ${hook.team.name} needs balancing...`);

    if (!CPPModules.find((p) => p.id === hook.project.id))
        return Logger.log(`Requires no balance, not a CPP Module`);
	if (hook.scale.correction_number != 2)
		return Logger.log(`No balance yet needed, only did 1 evaluation`);

    // Deduct point from pool.
    const poolResponse = await Intra.api.delete(`/pools/39/points/remove`, {
        "points": 1
    });

    if (!poolResponse.ok)
		return Logger.log(`Failed to remove point from pool: ${poolResponse.statusText}`);

    // Give the user that point
    const userResponse = await Intra.api.post(`/users/${92103}/correction_points/add`, {});
    if (!userResponse.ok)
        return Logger.log(`Failed to add point to user: ${userResponse.statusText}`);
}

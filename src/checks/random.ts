// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { Config } from "../config";

/*============================================================================*/

/**
 * Simply randomly decide if a Peer++ lock is required.
 * The weight / probability can be altered via the config.
 *
 * @return True if the team's final evaluation should be locked, false otherwise.
 */
export async function Random() {
	return Math.random() < Config.randomEvalChance / 100;
}

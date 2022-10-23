// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { Config } from "../config";

/*============================================================================*/

/**
 * Simply randomly decide if an evaluation is required.
 * The weight / probability can be altered via the config.
 * 
 * @return True if check passed, false otherwise.
 */
export async function Random() {
	return Math.random() >= (Config.randomEvalChance / 100);
}
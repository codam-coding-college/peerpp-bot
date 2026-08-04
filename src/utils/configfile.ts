// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022-2026.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import fs from "fs";

/*============================================================================*/

/** Thrown when a config file the bot cannot run without does not exist. */
export class MissingConfigFileError extends Error {}

/** Reads a config file that the bot cannot run without. */
export function readConfigFile(path: string, hint: string): string {
	try {
		return fs.readFileSync(path).toString();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

		throw new MissingConfigFileError(`Missing config file: ${path}\n${hint}`);
	}
}

/*============================================================================*/

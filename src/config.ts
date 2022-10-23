// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import fs from "fs";

/*============================================================================*/

namespace Configuration {
	export const file = fs.readFileSync("./config/config.json").toString();

	export interface Layout {
		campusID: number;
		cursusID: number;
		botID: number;
		groupID: number;
		lockExpirationDays: number;
		logOutput: string,
		randomEvalChance: number;
		projects: { id: number; name: string }[];
	}
}

/** The configuration file that stores parameters for the behaviour of the bot */
export const Config: Configuration.Layout = JSON.parse(Configuration.file);

/*============================================================================*/

// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022-2026.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import { MissingConfigFileError, readConfigFile } from "./utils/configfile";

/*============================================================================*/

namespace Configuration {
	function read(): string {
		try {
			return readConfigFile("./config/config.json", "config/config.json is part of the repository. In Docker, mount ./config into /app/config.");
		} catch (error) {
			if (!(error instanceof MissingConfigFileError)) throw error;

			console.error(error.message);
			process.exit(1);
		}
	}

	export const file = read();

	export interface Layout {
		sentryID: number;
		campusID: number;
		cursusID: number;
		botID: number;
		groupID: number;
		poolID: number;
		lockExpirationDays: number;
		randomEvalChance: number;
		logOutput: string;
		dbPath: string;
		projects: { id: number; name: string }[];
		blocked: { studentA: string; studentB: string }[];

		/** Slack member IDs of the staff to notify whenever an evaluation is booked. Optional, leave empty to notify no-one. */
		staffSlackIDs?: string[];
	}
}

/** The configuration file that stores parameters for the behaviour of the bot */
export const Config: Configuration.Layout = JSON.parse(Configuration.file);

/*============================================================================*/

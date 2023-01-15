// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import fs from "fs";
import dotenv from "dotenv";

/*============================================================================*/

namespace Environment {
	export const file = dotenv.parse(fs.readFileSync("./config/.env"));

	export interface Layout {
		SLACK_TOKEN: string;
		SLACK_APP_TOKEN: string;

		WEBHOOK_CREATE_SECRET: string;
		WEBHOOK_DELETE_SECRET: string;
		WEBHOOK_UPDATE_SECRET: string;

		INTRA_UID: string;
		INTRA_SECRET: string;

		WEBHOOK_PORT: number;
		SLACKBOT_PORT: number;
	}
}

/** The environment file to store sensitive data such as secrets & tokens. */
export const Env: Environment.Layout = {
	SLACK_TOKEN: Environment.file["SLACK_TOKEN"]!,
	SLACK_APP_TOKEN: Environment.file["SLACK_APP_TOKEN"]!,

	WEBHOOK_CREATE_SECRET: Environment.file["WEBHOOK_CREATE_SECRET"]!,
	WEBHOOK_DELETE_SECRET: Environment.file["WEBHOOK_DELETE_SECRET"]!,
	WEBHOOK_UPDATE_SECRET: Environment.file["WEBHOOK_UPDATE_SECRET"]!,

	INTRA_UID: Environment.file["INTRA_UID"]!,
	INTRA_SECRET: Environment.file["INTRA_SECRET"]!,

	WEBHOOK_PORT: parseInt(Environment.file["WEBHOOK_PORT"]!),
	SLACKBOT_PORT: parseInt(Environment.file["SLACKBOT_PORT"]!),
};

/*============================================================================*/

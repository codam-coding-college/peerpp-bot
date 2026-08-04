// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022-2026.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import dotenv from "dotenv";
import { MissingConfigFileError, readConfigFile } from "./utils/configfile";

/*============================================================================*/

namespace Environment {
	function read(): string {
		try {
			return readConfigFile("./config/.env", "Copy config/.env-example to config/.env and fill in the values. In Docker, mount ./config into /app/config.");
		} catch (error) {
			if (!(error instanceof MissingConfigFileError)) throw error;

			console.error(error.message);
			process.exit(1);
		}
	}

	const file = dotenv.parse(read());

	export interface Layout {
		SLACK_TOKEN: string;
		SLACK_APP_TOKEN: string;

		WEBHOOK_CREATE_SECRET: string;
		WEBHOOK_DELETE_SECRET: string;
		WEBHOOK_UPDATE_SECRET: string;

		INTRA_UID: string;
		INTRA_SECRET: string;

		SENTRY_SECRET: string;

		WEBHOOK_PORT: number;
		SLACKBOT_PORT: number;
	}

	/** Returns the value of the given key, or undefined when it is absent or empty. */
	function optional(key: string): string | undefined {
		const value = file[key]?.trim();
		return value ? value : undefined;
	}

	/**
	 * Reads the environment and exits with a report of everything that is wrong with it,
	 * so a misconfigured bot never gets as far as talking to Intra or Slack.
	 */
	export function load(): Layout {
		const problems: string[] = [];

		/** A secret the bot cannot run without. */
		function secret(key: string): string {
			const value = optional(key);
			if (value === undefined) problems.push(`${key} is missing or empty`);
			return value ?? "";
		}

		/** A port, or undefined when it is not set, so the caller can supply its default. */
		function port(key: string): number | undefined {
			const value = optional(key);
			if (value === undefined) return undefined;

			const parsed = Number(value);
			if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
				problems.push(`${key} is not a valid port number: "${value}"`);
				return undefined;
			}
			return parsed;
		}

		const env: Layout = {
			SLACK_TOKEN: secret("SLACK_TOKEN"),
			SLACK_APP_TOKEN: secret("SLACK_APP_TOKEN"),

			WEBHOOK_CREATE_SECRET: secret("WEBHOOK_CREATE_SECRET"),
			WEBHOOK_DELETE_SECRET: secret("WEBHOOK_DELETE_SECRET"),
			WEBHOOK_UPDATE_SECRET: secret("WEBHOOK_UPDATE_SECRET"),

			INTRA_UID: secret("INTRA_UID"),
			INTRA_SECRET: secret("INTRA_SECRET"),

			SENTRY_SECRET: optional("SENTRY_SECRET") ?? "",

			WEBHOOK_PORT: port("WEBHOOK_PORT") ?? 8080,
			SLACKBOT_PORT: port("SLACKBOT_PORT") ?? 3000,
		};

		if (problems.length > 0) {
			console.error("Invalid configuration in ./config/.env:");
			for (const problem of problems) console.error(`  - ${problem}`);
			console.error("See config/.env-example for the values the bot expects.");
			process.exit(1);
		}

		return env;
	}
}

/** The environment file to store sensitive data such as secrets & tokens. */
export const Env: Environment.Layout = Environment.load();

/*============================================================================*/

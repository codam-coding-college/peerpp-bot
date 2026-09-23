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

	/**
	 * Rejects project names containing whitespace. The Slack commands take several projects
	 * separated by a space, so a name with a space in it could never be typed on its own.
	 * Use underscores instead, as the rest of the names do.
	 */
	export function validateProjectNames(config: Layout) {
		const invalid = config.projects.filter((project) => /\s/.test(project.name));
		if (invalid.length === 0) return;

		throw new Error(
			`config/config.json: project names cannot contain whitespace, use underscores instead. Offending project(s): ` +
				invalid.map((project) => `${project.id} "${project.name}"`).join(", ")
		);
	}
}

/** The configuration file that stores parameters for the behaviour of the bot */
export const Config: Configuration.Layout = JSON.parse(Configuration.file);

Configuration.validateProjectNames(Config);

/*============================================================================*/

/**
 * Looking projects up, by the id Intra knows them by and by the name the bot calls them.
 *
 * The config can list the same name under several ids, because Intra splits a project
 * that students see as one over multiple entries. The bot hides that: a user always
 * favorites, books and sees a name, which stands for every id behind it.
 */
export namespace Projects {
	/** The name of every project, lowercased, listed once even when several ids share it. */
	export function names(): string[] {
		return [...new Set(Config.projects.map((project) => project.name.toLowerCase()))];
	}

	/** The name the bot calls the given project, or undefined when the config does not list it. */
	export function nameOf(projectID: number): string | undefined {
		return Config.projects.find((project) => project.id === projectID)?.name.toLowerCase();
	}

	/**
	 * Strips what users paste around a project name. Every command prints project names wrapped
	 * in backticks, so copying one straight out of `/projects` hands the bot ``libft`` — which
	 * matches nothing, and mangles the reply that echoes it, because Slack pairs the backticks
	 * with the ones the bot added itself.
	 *
	 * No project name contains one of these characters, so dropping them cannot hide a real name.
	 */
	export function clean(given: string): string {
		return given.replace(/[`'"]/g, "").trim().toLowerCase();
	}

	/**
	 * Resolves what a user typed to a project of the config.
	 * @returns The name lowercased and every id behind it, or undefined when it is not a project.
	 */
	export function find(given: string): { name: string; ids: number[] } | undefined {
		const name = clean(given);
		const ids = Config.projects.filter((project) => project.name.toLowerCase() === name).map((project) => project.id);

		return ids.length > 0 ? { name, ids } : undefined;
	}
}

/*============================================================================*/

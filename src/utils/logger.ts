// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import fs from "fs";
import path from "path";

/*============================================================================*/

/** The different levels of logging. */
export enum LogType {
	INFO,
	ERROR,
	WARNING,
	HOOK
}

/** A console.log wrapper for IO operations on the terminal and output */
class Logger {

	/** The file path where the logs are stored. */
	public static outputPath: string = "log.txt";

	//= Private =//

	/**
	 * Create the logfile via the given path.
	 * @param outputPath The relative or absolute file path of the log to create, needs extension!
	 */
	public static setPath(outputPath: string) {
		this.outputPath = outputPath;
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	}

	/**
	 * Log a given message with a given optional log type.
	 * @param message The message to log.
	 * @param type The type of log @see LogType.
	 */
	public static async log(message: string, type: LogType = LogType.INFO) {
		const line = `[${this.nowISO()}] [${LogType[type]}] ${message}`;

		switch (type) {
			case LogType.WARNING: {
				console.warn(line);
				break;
			}
			case LogType.ERROR: {
				console.error(line);
				break;
			}
			default: {
				console.log(line);
				break;
			}
		}

		await fs.promises.appendFile(this.outputPath, `${line}\n`);
	}

	//= Private =//

	// Get the current ISO time as a string.
	private static nowISO(): string {
		return `${new Date().toISOString().slice(0, -5)}Z`;
	}

}

/*============================================================================*/

export default Logger
import fs from "fs";
import path from "path";
import { IntraResponse } from "./types";

/* ************************************************************************** */

const logPath = `logs/out.log`;
fs.mkdirSync(path.dirname(logPath), { recursive: true });

/* ************************************************************************** */

/**
 * Logging class to log the behaviour of the app.
 */
class Logger {

	/// Public ///

	/**
	 * Logs a message, prints to console and writes to the log file.
	 * @param msg The message to log.
	 */
	public static async log(msg: string) {
		const line = `[INFO] [${this.nowISO()}] : ${msg}`
		
		console.log(line);
		await fs.promises.appendFile(logPath, `${line}${line.match(/\n$/) ? "" : "\n"}`);
	}

	/**
	 * Logs a message, prints to console and writes to the log file.
	 * @param msg The message to log.
	 */
	public static async err(msg: string) {
		const line = `[ERROR] [${this.nowISO()}] : ${msg}`

		console.trace(line);
		await fs.promises.appendFile(logPath, `${line}${line.match(/\n$/) ? "" : "\n"}`);
	}

	/**
	 * Logs a webhook response.
	 * @param status The status.
	 * @param hook The hook response.
	 * @param reason The reason.
	 */
	public static async logHook(
		status: "required" | "ignored" | "error",
		hook: IntraResponse.Webhook.Root | null,
		reason: string) {

		const line = `[HOOK] [${this.nowISO()}] : ${status.padEnd(8, " ")} | ${reason}`;
		console.log(`${line} -> ${JSON.stringify(hook?.project)}`);
	
		await fs.promises.appendFile(logPath, `${line}-> ${JSON.stringify(hook?.project)}\n`);
	}

	/// Private ///

	// Get the current ISO time as a string.
	private static nowISO(): string {
		return `${new Date().toISOString().slice(0, -5)}Z`;
	}
}

export default Logger;

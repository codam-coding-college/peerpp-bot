// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import Raven from "raven";
import { Response } from "node-fetch";
import { LogType } from "./logger";

/*============================================================================*/

/**
 * Raven function wrappes, we are aware that we're using a deprecated version.
 * For now other services also run on a deprecated service, maybe in the future
 * we can switch to the newer sentry npm package instead.
 * 
 * So then we can just change these functions for ease of migration.
 */
namespace RavenUtils {
	/**
	 * Send a message to with Sentry.
	 * @param message The message to send.
	 * @param type The message type @see LogType.
	 */
	export function ReportMSG(message: string, type: LogType) {
		Raven.captureMessage(message, { level: LogType[type] });
	}

	/**
	 * Report 400 Errors to sentry.
	 * @param response The response to check @see Response.
	 */
	export function ReportURL(response: Response) {
		if (!response.ok && (response.status >= 400 && response.status < 500))
			Raven.captureMessage(response.statusText, { level: LogType[LogType.ERROR] });
	}

	/**
	 * Report exception errors to sentry.
	 * @param error The exception to report @see Error. 
	 */
	export function ReportErr(error: Error) {
		Raven.captureException(error);
	}
}

/*============================================================================*/

export default RavenUtils
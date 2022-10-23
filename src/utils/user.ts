// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import Intra from "./intra";
import Logger from "./logger";
import { Config } from "../config";
import { UsersInfoResponse } from "@slack/web-api";

/*============================================================================*/

/** User object to store useful data. */
export interface User {
	// ID
	intraUID: number;
	slackUID: string;
	intraLogin: string;
	email: string;

	// Additional info
	level: number;
	staff: boolean;
	campusID: number;
}

/**  */
export interface IncompleteUser {
	// ID
	intraUID?: number;
	slackUID?: string;
	intraLogin?: string;
	email?: string;

	// Additional info
	level?: number;
	staff?: boolean;
	campusID?: number;
}

/*============================================================================*/

/**
 * Check if we have missing intra data & enough data to construct the missing info.
 * @param user The incomplete user data.
 * @returns True if we can construct the missing data with the current existing data.
 */
function isIntraDataMissing(user: IncompleteUser): boolean {
	return (
		(user.intraLogin !== undefined || user.intraUID !== undefined) && (
			user.level === undefined || 
			user.campusID === undefined || 
			user.staff === undefined)
	)
}

/**
 * Is either the slackuid or email missing, if so we can use either to build the other.
 * @param user The incomplete user data.
 * @returns True if we can construct the missing data with the current existing data.
 */
function isSlackDataMissing(user: IncompleteUser): boolean {
	return (user.slackUID === undefined || user.email === undefined)
}

/*============================================================================*/

/**
 * Fetch data from intra to complete the information only availble on intra.
 * @param user The incomplete user data.
 */
async function fetchIntraData(user: IncompleteUser) {
	const isUIDValid = user.intraUID !== undefined;
	const id = (isUIDValid ? user.intraUID : user.intraLogin)!;

	const userResponse = await Intra.api.get(`/users/${id}`);
	if (!userResponse.ok)
		throw new Error(`Unable to fetch user ${id}: Reason: "${userResponse.statusText}"`)

	const json = await userResponse.json();
	user.intraLogin = isUIDValid ? json.login : user.intraLogin;
	user.intraUID = isUIDValid ? user.intraUID : json.id;
	user.email = user.email == undefined ? json.email : user.email;
	user.staff = json["staff?"];

	for (const cursusUser of json.cursus_users) {
		if (cursusUser.cursus_id == Config.cursusID) {
			user.level = cursusUser.level;
			break;
		}
	}

	// TODO: Check if this is actually necessary todo.
	if (user.level === undefined)
		throw new Error(`Could not find user in cursus ${Config.cursusID}}`);

	// Get the campus
	user.campusID = 1; // Default to Paris
	for (const campusUser of json.campus_users) {
		if (campusUser.is_primary) 
			user.campusID = campusUser.campus_id;
	}
}

/*============================================================================*/


/**
 * Recursive function that fetches the complete user data if one of the 4 required
 * IDs are filled in.
 * 
 * @Note This action is expensive due to various API calls.
 * 
 * @param user The incomplete user object with partial information.
 * @returns A completed user object with all the information.
 */
export async function getFullUser(user: IncompleteUser): Promise<User> {
	// Ensure that we have at least one required property is filled.
	if (!user.intraUID && !user.slackUID && !user.intraLogin && !user.email)
		throw new Error(`Unable to fetch full user, missing required ID fields`);

	if (isIntraDataMissing(user)) {
		await fetchIntraData(user);
		return getFullUser(user);
	}
	else if (isSlackDataMissing(user)) {
		// Do we have the UID?
		if (user.slackUID != undefined) {

			await slackApp.client.users.info({
				user: user.slackUID!,
			}).catch((reason: any) => {
				throw new Error(`Could not find slackID ${user.slackUID}: ${reason}`);
			}).then((value: UsersInfoResponse) => {
				if (!value.user?.profile?.display_name)
					throw new Error(`User from slackUID "${user.slackUID}" has no display name`);
				user.intraLogin = value.user.profile.display_name;
			})
		}
		// Fetch via email
		else if (user.email != undefined) {
			await slackApp.client.users.lookupByEmail({
				email: user.email!,
			}).catch((reason) => {
				throw new Error(`Could not get email ${user.email}: ${reason}`);
			}).then((value) => {
				user.slackUID = value.user!.id;
			});
		}

		return getFullUser(user);
	}

	// Make sure we have all the data, also
	if (Object.values(user).find((value) => value == undefined))
		throw new Error(`Failed to fetch full data: ${JSON.stringify(user)}`);
	Logger.log(`Fetched user: "${user.intraLogin}"`);
	return {
		intraUID: user.intraUID!,
		intraLogin: user.intraLogin!,
		email: user.email!,
		slackUID: user.slackUID!,
		level: user.level!,
		staff: user.staff!,
		campusID: user.campusID!,
	};
}

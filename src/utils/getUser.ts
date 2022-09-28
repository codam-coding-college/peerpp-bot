import Logger from "./log";
import { env } from "./env";
import { Intra } from "./intra/intra";
import { IncompleteUser, User } from "./types";
import { UsersInfoResponse } from "@slack/web-api";
import { slackApp } from "../slackbot/slack";

/* ************************************************************************** */

/**
 * Check if we have missing intra data & enough data to construct the missing info.
 * @param user The incomplete user data.
 * @returns True if we can construct the missing data with the current existing data.
 */
function isIntraDataMissing(user: IncompleteUser): boolean {
	return (
		(user.intraLogin != undefined || user.intraUID != undefined) && (
			user.level == undefined || 
			user.campusID == undefined || 
			user.staff == undefined
	))
}

/**
 * Is either the slackuid or email missing, if so we can use either to build the other.
 * @param user The incomplete user data.
 * @returns True if we can construct the missing data with the current existing data.
 */
function isSlackDataMissing(user: IncompleteUser): boolean {
	return (user.slackUID == undefined || user.email == undefined)
}

/* ************************************************************************** */

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

	// TODO: Split into two functions.
	// TODO: Use interfaces for a more convenience.
	// Fetch intra data if we have at least the login or UID.
	if (isIntraDataMissing(user)) {
		Logger.log("Fetching intra user data")

		const isUIDValid = user.intraUID != undefined;
		const id = (isUIDValid ? user.intraUID : user.intraLogin)!;

		// Check which one we have, pick either.
		const response = await Intra.api.get(`/users/${id}`).catch((reason: any) => {
			throw new Error(`Unable to fetch user ${id}, reason ${reason}`)
		})

		if (!response.ok) {
			Logger.err(`Failed to fetch user "${id}" with response ${response.status}`);
			throw new Error(`Unable to fetch user ${id}: Reason: "${response.statusText}"`)
		}

		// Get the user name / id.
		const json = await response.json();

		user.intraLogin = isUIDValid ? json.login : user.intraLogin;
		user.intraUID = isUIDValid ? user.intraUID : json.id;
		user.email = user.email == undefined ? json.email : user.email;
		user.staff = json["staff?"];
		
		// Get the level
		for (const cursusUser of json.cursus_users) {
			if (cursusUser.cursus.id === env.CURSUS_ID) {
				user.level = cursusUser.level;
				break;
			}
		}

		// TODO: Check if this is actually necessary todo.
		if (user.level === undefined)
			throw `Could not find user in cursus ${env.CURSUS_ID}}`;

		// Get the campus
		user.campusID = 1; // Default to Paris
		for (const campusUser of json.campus_users) {
			if (campusUser.is_primary) 
				user.campusID = campusUser.campus_id;
		}
		Logger.log(`Fetched user: "${user.intraLogin}"`);
		return getFullUser(user);
	}
	// Fetch slack or email using either.
	else if (isSlackDataMissing(user)) {
		Logger.log("Fetching slack user data")

		// Do we have the UID?
		if (user.slackUID != undefined) {

			await slackApp.client.users.info({
				user: user.slackUID!,
			}).catch((reason: any) => {
				Logger.err(`Unable to find slack account: "${user.slackUID}:"`);
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
				Logger.err(`Unable to find slack account with email: "${user.email}:" Possible mismatch?`);
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

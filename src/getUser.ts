import { app } from "./slack/slack";
import { UsersInfoResponse } from "@slack/web-api";
import { Intra } from "./intra/intra";
import { IncompleteUser, IntraResponse, User } from "./types";
import { env } from "./env";

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
		throw Error(`Unable to fetch full user, missing required ID fields`);

	// TODO: Split into two functions.
	// Fetch intra data if we have at least the login or UID.
	if (user.intraUID || user.intraLogin && (!user.campusID || !user.email || !user.slackUID)) {

		const isUIDValid = user.intraUID != undefined;
		const id = (isUIDValid ? user.intraUID : user.intraLogin)!;

		// Check which one we have, pick either.
		const response = await Intra.api.get(`/users/${id}`).catch((reason: any) => {
			throw Error(`Unable to fetch user ${id}, reason ${reason}`)
		})

		// Get the user name / id.
		// TODO: Maybe recreate the type for this.
		const json = await response.json();
		user.intraLogin = isUIDValid ? json.login : user.intraLogin;
		user.intraUID = isUIDValid ? json.id : user.intraUID;
		user.email = user.email == undefined ? json.email : user.email;
		user.staff = json["staff?"];

		// Get the level
		const cursusUsers = json.cursus_users as IntraResponse.CursusUser[];
		for (const cursusUser of cursusUsers) {
			if (cursusUser.cursus.id === env.CURSUS_ID) {
				user.level = cursusUser.level;
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

		return getFullUser(user);
	}
	// Fetch slack or email using either.
	else if (user.slackUID || user.email) {

		// Do we have the UID?
		if (user.slackUID) {
			await app.client.users.info({
				user: user.slackUID!,
			}).catch((reason: any) => {
				throw Error(`Could not find slackID ${user.slackUID}: ${reason}`);
			}).then((value: UsersInfoResponse) => {
				if (!value.user?.profile?.display_name)
					throw Error(`User from slackUID "${user.slackUID}" has no display name`);
				user.intraLogin = value.user.profile.display_name;
			})
		}
		// Fetch via email
		else {
			await app.client.users.lookupByEmail({
				email: user.email!,
			}).catch((reason) => {
				throw `Could not get email ${user.email}: ${reason}`
			}).then((value) => {
				user.slackUID = value.user!.id;
			});
		}

		return getFullUser(user);
	}

	// Make sure we have all the data, also
	if (Object.values(user).find((value) => value == undefined))
		throw Error(`Failed to fetch full data: ${JSON.stringify(user)}`);
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

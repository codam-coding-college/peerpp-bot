import { app } from "./slack/slack";
import { Intra } from "./intra/intra";
import { User } from "./types";
import { UsersInfoResponse } from "@slack/web-api";
import { env } from "./env";
import Logger from "./log";

/* ************************************************************************** */

export interface IncompleteUser {
	intraUID?: Intra.UID;
	intraLogin?: Intra.Login;
	email?: string;
	slackUID?: string;

	// do not pass these
	level?: number;
	staff?: boolean;
	campusID?: number;
}

/* ************************************************************************** */

// give this function 1-n of the IncompleteUser params and it will return a fully completed User Object
export async function getFullUser(u: IncompleteUser): Promise<User> {
	// use intraUID to generate intraLogin, email, level, staff


	// TODO: Ugly disgusting hack, this whole function will get nuked later ...
	if (
		u.campusID != undefined &&
		u.email != undefined &&
		u.intraLogin != undefined &&
		u.intraUID != undefined &&
		u.level != undefined &&
		u.slackUID != undefined &&
		u.staff != undefined
	) {
		Logger.log("Fetched data:")
		Logger.log(u);
		return {
			intraUID: u.intraUID,
			intraLogin: u.intraLogin,
			email: u.email,
			slackUID: u.slackUID,
			level: u.level,
			staff: u.staff,
			campusID: u.campusID,
		};
	}

	if (
		u.intraUID &&
		(!u.intraLogin ||
			!u.email ||
			u.level === undefined ||
			!u.staff ||
			u.campusID)
	) {
		const response = await Intra.api.get<any>(`/v2/users/${u.intraUID}`);
		u.intraLogin = response.json.login;
		u.email = response.json.email;
		u.staff = !!response.json["staff?"];
		for (const user of response.json.cursus_users) {
			if (user.cursus.id === env.CURSUS_ID) {
				u.level = user.level;
				break;
			}
		}
		if (u.level === undefined)
			throw `Could not find user in cursus ${
				env.CURSUS_ID
			} | ${JSON.stringify(response.json)}`;

		u.campusID = 1; // default is paris
		for (const campusUser of response.json.campus_users) {
			if (campusUser.is_primary) u.campusID = campusUser.campus_id;
		}
		return getFullUser(u);
	}

	// use intraLogin to generate intraUID and email
	if (u.intraLogin && (!u.intraUID || !u.email)) {
		const response = await Intra.api.get<any>(`/v2/users/${u.intraLogin}`);
		if (!response.ok) throw `Could not find user "${u.intraLogin}"`;
		u.intraUID = response.json.id;
		u.email = response.json.email;
		return getFullUser(u);
	}

	// use slackUID to generate intraLogin
	if (u.slackUID && !u.intraLogin) {
		const response: UsersInfoResponse = await app.client.users.info({
			user: u.slackUID!,
		});
		if (!response.ok)
			throw `Could not find user from slackUID "${u.slackUID}"`;
		if (!response.user?.profile?.display_name)
			throw `User from slackUID "${u.slackUID}" has no display name`;
		// this should be set by the intra team, and cannot be changed by users
		u.intraLogin = response.user.profile.display_name;
		return getFullUser(u);
	}

	// use email to generate slack UID
	if (u.email && !u.slackUID) {
		const slackUser = await app.client.users.lookupByEmail({
			email: u.email,
		});
		if (!slackUser.ok) throw `Could not get email ${u.email}`;
		u.slackUID = slackUser.user!.id;
		return getFullUser(u);
	}

	if (Object.values(u).find((v) => !v))
		throw `Missing fields in user: ${JSON.stringify(u)}`;
	return {
		intraUID: u.intraUID!,
		intraLogin: u.intraLogin!,
		email: u.email!,
		slackUID: u.slackUID!,
		level: u.level!,
		staff: u.staff!,
		campusID: u.campusID!,
	};
}

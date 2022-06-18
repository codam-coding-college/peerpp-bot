import { app } from './slack'
import { Intra } from './intra/intra';
import { User } from './types'
import { api } from './api'
import { UsersInfoResponse } from '@slack/web-api';

export interface IncompleteUser {
	intraUID?: Intra.UID
	intraLogin?: Intra.Login
	email?: string
	slackUID?: string
}

// give this function 1-n of the IncompleteUser params and it will return a fully completed User Object
export async function getFullUser(u: IncompleteUser): Promise<User> {
	// use intraUID to generate intraLogin and email
	if (u.intraUID && (!u.intraLogin || !u.email)) {
		const response = await api.get(`/v2/users/${u.intraUID}`)
		if (!response.ok)
			throw `Cannot get user from uid "${u.intraUID}"`
		u.intraLogin = response.json.login
		u.email = response.json.email
		return getFullUser(u)
	}

	// use intraLogin to generate intraUID and email
	if (u.intraLogin && (!u.intraUID || !u.email)) {
		const response = await api.get(`/v2/users/${u.intraLogin}`)
		if (!response.ok)
			throw `Could not find user "${u.intraLogin}"`
		u.intraUID = response.json.id
		u.email = response.json.email
		return getFullUser(u)
	}

	// use slackUID to generate intraLogin
	if (u.slackUID && !u.intraLogin) {
		const response: UsersInfoResponse = await app.client.users.info({ user: u.slackUID! })
		if (!response.ok)
			throw `Could not find user from slackUID "${u.slackUID}"`
		if (!response.user?.profile?.display_name)
			throw `User from slackUID "${u.slackUID}" has no display name`
		// this should be set by the intra team, and cannot be changed by users
		u.intraLogin = response.user.profile.display_name
		return getFullUser(u)
	}

	// use email to generate slack UID
	if (u.email && !u.slackUID) {
		const slackUser = await app.client.users.lookupByEmail({ email: u.email })
		if (!slackUser.ok)
			throw `Could not get email ${u.email}`
		u.slackUID = slackUser.user!.id
		return getFullUser(u)
	}

	if (Object.values(u).find(v => !v))
		throw `Missing fields in user: ${JSON.stringify(u)}`
	return {
		intraUID: u.intraUID!,
		intraLogin: u.intraLogin!,
		email: u.email!,
		slackUID: u.slackUID!,
	}
}

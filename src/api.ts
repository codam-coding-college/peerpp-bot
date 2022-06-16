import fetch from 'node-fetch'
import parameterAppend from 'url-parameter-append'
import { env } from './env'


interface AccessToken {
	access_token: string
	token_type: string
	expires_in: number
	scope: string
	created_at: number
}

class RequestLimiter {
	private _maxRequestPerSecond: number
	private _thisSecond: number
	private _requestsThisSecond: number

	constructor(maxRequestPerSecond: number) {
		this._maxRequestPerSecond = maxRequestPerSecond
		this._thisSecond = 0
		this._requestsThisSecond = 0
	}

	async limit(): Promise<void> {
		const now = Date.now()
		if (Math.floor(now / 1000) != this._thisSecond) {
			this._requestsThisSecond = 0
			this._thisSecond = Math.floor(now / 1000)
			return
		}
		this._requestsThisSecond++
		if (this._requestsThisSecond >= this._maxRequestPerSecond) {
			await new Promise(resolve => setTimeout(resolve, ((this._thisSecond + 1) * 1000) - now))
		}
	}
}

interface Response {
	ok: boolean
	json: any | any[] | undefined
}

class API {
	private _root: string
	private _UID: string
	private _secret: string
	private _accessToken: AccessToken | null
	private _logging: boolean
	private _accessTokenExpiry: number
	private _startCooldown: number
	private _cooldown: number
	private _cooldownGrowthFactor: number
	private _limiter: RequestLimiter

	constructor(clientUID: string, clientSecret: string, maxRequestPerSecond: number = 1 / 3, logging: boolean = false, root = 'https://api.intra.42.fr') {
		this._logging = logging
		this._root = root
		this._UID = clientUID
		this._secret = clientSecret
		this._accessToken = null
		this._accessTokenExpiry = -1
		this._startCooldown = 1500
		this._cooldown = this._startCooldown
		this._cooldownGrowthFactor = 2
		this._limiter = new RequestLimiter(maxRequestPerSecond)
	}

	private async _fetch(path: string, opt: Object, isTokenUpdateRequest: boolean): Promise<Response> {
		console.log('fetch', isTokenUpdateRequest)
		if (!isTokenUpdateRequest) {
			await this._updateToken()
			Object.assign(opt, { headers: { Authorization: `Bearer ${this._accessToken?.access_token}` } })
		}

		if (this._logging)
			console.log(`${new Date().toISOString()} REQUEST ${path}, ${JSON.stringify(opt)}`)

		await this._limiter.limit()
		const response = await fetch(path, opt)
		if (response.status === 429) {
			if (this._logging)
				console.log(`${new Date().toISOString()} [fetch error]: status: ${response?.status} body: ${JSON.stringify(response)} retrying in ${this._cooldown / 1000} seconds`)
			await new Promise(resolve => setTimeout(resolve, this._cooldown))
			this._cooldown *= this._cooldownGrowthFactor
			return await this._fetch(path, opt, isTokenUpdateRequest)
		}
		this._cooldown = this._startCooldown
		let json = undefined
		try {
			json = await response.json()
		} catch (err) {
			console.log('no parse', err)
		}
		return { ok: true, json }
	}

	private async _updateToken() {
		console.log('update')
		if (this._accessTokenExpiry > Date.now() + 60 * 1000)
			return
		const opt = {
			method: 'POST',
			body: `grant_type=client_credentials&client_id=${this._UID}&client_secret=${this._secret}&scopes=public,projects`,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		}
		this._accessToken = (await this._fetch(`${this._root}/oauth/token`, opt, true)).json as AccessToken
		this._accessTokenExpiry = + Date.now() + this._accessToken!.expires_in * 1000
		if (this._logging)
			console.log(`[new token]: expires in ${this._accessToken!.expires_in} seconds, on ${new Date(this._accessTokenExpiry).toISOString()}`)
	}

	async get(path: string, parameters?: { [key: string]: string | number }[]): Promise<Response> {
		let requestPath = `${this._root}${path}`
		if (parameters)
			for (const key of parameters)
				requestPath = parameterAppend(requestPath, key)

		return await this._fetch(requestPath, {}, false)
	}

	async post(path: string, body: Object): Promise<Response> {
		const opt = {
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'POST',
			body: JSON.stringify(body)
		}
		return await this._fetch(`${this._root}${path}`, opt, false)
	}

	async delete(path: string): Promise<Response> {
		const opt = {
			method: 'DELETE',
		}
		return await this._fetch(`${this._root}${path}`, opt, false)
	}


	async getPaged(path: string, parameters?: { [key: string]: string | number }[], onPage?: (response: any) => void): Promise<Response> {
		let items: any[] = []
		let block

		if (!parameters)
			parameters = []
		if (!parameters['page[number]'] && !parameters['page_size'])
			parameters.push({ 'page[size]': 100 })
		parameters.push({ 'page[number]': '<placeholder>' })
		for (let i = 1; ; i++) {
			for (let p of parameters)
				if (p['page[number]'])
					p['page[number]'] = i

			block = await this.get(path, parameters)
			if (!block.ok)
				return { ok: false, json: items }
			if (block.json.length === 0)
				break
			if (onPage)
				onPage(block)
			items = items.concat(block)
		}
		return { ok: false, json: items }

	}
}

export const api: API = new API(env.INTRA_UID, env.INTRA_SECRET, 100, true)

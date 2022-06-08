import dotenv from 'dotenv'
import fs from 'fs'

interface Env {
	SLACK_TOKEN: string
	SIGNING_SECRET: string
	WEBHOOK_SECRET: string
	EVENT_ENDPOINT: string
	PEERPP_BOT_UID: number
	PEERPP_GROUP_ID: number
	PEERPP_SLACKBOT_ID: string
	SLACK_APP_TOKEN: string

	INTRA_UID: string
	INTRA_SECRET: string

	projectSlugs: { [key: string]: string }[]
}

const file = dotenv.parse(fs.readFileSync('.env'))
const projectSlugs: { [key: string]: string }[] = JSON.parse(fs.readFileSync('env/project_slugs.json').toString())

export const env: Env = {
	SLACK_TOKEN: file['SLACK_TOKEN']!,
	SIGNING_SECRET: file['SIGNING_SECRET']!,
	WEBHOOK_SECRET: file['WEBHOOK_SECRET']!,
	EVENT_ENDPOINT: file['EVENT_ENDPOINT']!,
	PEERPP_BOT_UID: parseInt(file['PEERPP_BOT_UID']!),
	PEERPP_GROUP_ID: parseInt(file['PEERPP_GROUP_ID']!),
	PEERPP_SLACKBOT_ID: file['PEERPP_SLACKBOT_ID']!,
	SLACK_APP_TOKEN: file['SLACK_APP_TOKEN']!,
	INTRA_UID: file['INTRA_UID']!,
	INTRA_SECRET: file['INTRA_SECRET']!,
	projectSlugs,
}

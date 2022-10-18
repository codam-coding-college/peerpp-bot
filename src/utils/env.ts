import fs from "fs";
import dotenv from "dotenv";
import Logger from "./log";

/* ************************************************************************** */

if (!fs.existsSync(".env")) {
	Logger.err("Missing '.env' file.")
	process.exit(1);
}
if (!fs.existsSync("project_slugs.json")) {
	Logger.err("Missing 'project_slugs.json' file.")
	process.exit(1);
}
const file = dotenv.parse(fs.readFileSync(".env"));

/* ************************************************************************** */

interface Env {
	SLACK_TOKEN: string;
	WEBHOOK_CREATE_SECRET: string;
	WEBHOOK_DELETE_SECRET: string;
	WEBHOOK_UPDATE_SECRET: string;
	PEERPP_BOT_UID: number;
	PEERPP_GROUP_ID: number;
	PEERPP_SLACKBOT_ID: string;
	SLACK_APP_TOKEN: string;

	INTRA_UID: string;
	INTRA_SECRET: string;

	expireDays: number;
	projects: { id: number; slug: string }[];
	CURSUS_ID: number;
	WATCHED_CAMPUS: number;
}

export const env: Env = {
	SLACK_TOKEN: file["SLACK_TOKEN"]!,
	WEBHOOK_CREATE_SECRET: file["WEBHOOK_CREATE_SECRET"]!,
	WEBHOOK_DELETE_SECRET: file["WEBHOOK_DELETE_SECRET"]!,
	WEBHOOK_UPDATE_SECRET: file["WEBHOOK_UPDATE_SECRET"]!,
	PEERPP_BOT_UID: parseInt(file["PEERPP_BOT_UID"]!),
	PEERPP_GROUP_ID: parseInt(file["PEERPP_GROUP_ID"]!),
	PEERPP_SLACKBOT_ID: file["PEERPP_SLACKBOT_ID"]!,
	SLACK_APP_TOKEN: file["SLACK_APP_TOKEN"]!,
	INTRA_UID: file["INTRA_UID"]!,
	INTRA_SECRET: file["INTRA_SECRET"]!,
	expireDays: 1,
	projects: JSON.parse(fs.readFileSync("project_slugs.json").toString()),
	CURSUS_ID: 21,
	WATCHED_CAMPUS: 14,
};

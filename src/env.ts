import dotenv from "dotenv";
import fs from "fs";

interface Env {
	SLACK_TOKEN: string;
	WEBHOOK_SECRET: string;
	PEERPP_BOT_UID: number;
	PEERPP_GROUP_ID: number;
	PEERPP_SLACKBOT_ID: string;
	SLACK_APP_TOKEN: string;

	INTRA_UID: string;
	INTRA_SECRET: string;

	projects: { id: number; slug: string }[];
	CURSUS_ID: number;
	WATCHED_CAMPUSES: number[];
}

const file = dotenv.parse(fs.readFileSync(".env"));

export const env: Env = {
	SLACK_TOKEN: file["SLACK_TOKEN"]!,
	WEBHOOK_SECRET: file["WEBHOOK_SECRET"]!,
	PEERPP_BOT_UID: parseInt(file["PEERPP_BOT_UID"]!),
	PEERPP_GROUP_ID: parseInt(file["PEERPP_GROUP_ID"]!),
	PEERPP_SLACKBOT_ID: file["PEERPP_SLACKBOT_ID"]!,
	SLACK_APP_TOKEN: file["SLACK_APP_TOKEN"]!,
	INTRA_UID: file["INTRA_UID"]!,
	INTRA_SECRET: file["INTRA_SECRET"]!,
	projects: JSON.parse(fs.readFileSync("env/project_slugs.json").toString()),
	CURSUS_ID: 21,
	WATCHED_CAMPUSES: [14],
};

import fs from "fs";
import { IntraResponse } from "./types";

export function nowISO(d?: Date): string {
	if (!d) d = new Date();
	return `${d.toISOString().slice(0, -5)}Z`;
}

fs.mkdirSync("logs", { recursive: true });

export async function log(line: string, path: string = "logs/out.log") {
	const now = nowISO();
	console.log(`${now} | ${line}`);
	await fs.promises.appendFile(
		path,
		`${now} | ${line}${line.match(/\n$/) ? "" : "\n"}`
	);
}

export async function logErr(line: string, path: string = "logs/err.log") {
	const now = nowISO();
	console.error(`${now} | ${line}`);
	await fs.promises.appendFile(
		path,
		`${now} | ${line}${line.match(/\n$/) ? "" : "\n"}`
	);
}

export async function logHook(
	status: "required" | "ignored" | "error",
	hook: IntraResponse.Webhook.Root | null,
	reason: string
) {
	const now = nowISO();
	const path = "./logs/hook.log";
	const line = `${now} | ${status.padEnd(8, " ")} | ${reason} | `;
	console.log(line + `<see ${path}>`);

	await fs.promises.appendFile(path, line + JSON.stringify(hook) + "\n");
}

// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import DB from "../db";
import { Env } from "../env";
import express from "express";
import { Config } from "../config";
import Intra from "../utils/intra";
import { SlackBot } from "./slackbot";
import { getFullUser } from "../utils/user";
import { IntraWebhook } from "../utils/types";
import Logger, { LogType } from "../utils/logger";
import { Request, Response, NextFunction } from "express";
import * as Checks from "../checks/index";
import db from "../db";

/*============================================================================*/

// Intra, like many distributed systems will sometimes deliver the same webhook > 1 times
// This is where we filter those situations
async function filterAlreadyDeliveredWebhook(req: Request) {
	const headerKey = "x-delivery";
	const id = req.headers[headerKey];
	if (!id || typeof id !== "string") {
		Logger.log(`WEBHOOK: Request header "${headerKey}" has invalid value of: "${id}"`);
		return false;
	}

	const hasDelivery = await db.hasWebhookDelivery(id).catch((e) => {
		Logger.log(`WEBHOOK: Could not load from db: ${e}`);
		return false;
	});
	if (hasDelivery) {
		return true;
	}

	await db.addWebhookDelivery(id).catch((e) => {
		Logger.log(`WEBHOOK: Could not add webhook delivery: ${e}`);
	});

	return false;
}

/**
 * Filters for requests and sends back corresponding error.
 * @param req The incoming request.
 * @param secret The Webhook secret.
 * @returns Status code and error message.
 */
async function filterHook(req: Request, secret: string) {
	if (!req.is("application/json")) {
		return { code: 400, msg: "Content-Type is not application/json" };
	}
	if (!req.headers["x-delivery"]) {
		return { code: 400, msg: "X-Delivery header missing" };
	}
	if (!req.headers["x-secret"]) {
		return { code: 400, msg: "X-Secret header missing" };
	}
	if (req.headers["x-secret"] !== secret) {
		return { code: 412, msg: "X-Secret header incorrect" };
	}
	if (await filterAlreadyDeliveredWebhook(req)) {
		return { code: 200, msg: "Webhook already received" };
	}
	return null;
}

/**
 * Checks the evaluator and evaluatee, blocks their evaluation if
 * they are listed as blocked.
 * @param hook The Intra webhook response.
 */
async function blockPotentialEvaluation(hook: IntraWebhook.Root) {
	if (!hook.user || !hook.user.login) {
		Logger.log("blockPotentialEvaluation: ignored evaluation, no corrector (hook.user.login)");
		return false;
	}

	const corrector = hook.user.login;
	const correctds = await Intra.getTeamUsers(hook.team.id);

	// Fetch the users this user is blocked with.
	const blockedUsers = Config.blocked.filter((value) => {
		return value.studentA == corrector || value.studentB == corrector;
	});

	// Check if any of the correctds is in that list, if so return true.
	let yeetIt: boolean = false;
	for (const student of correctds) {
		const matchedBlocks = blockedUsers.filter((value) => {
			return value.studentA == student.user.login || value.studentB == student.user.login;
		});

		// No match, bye felica.
		if (matchedBlocks.length == 0) continue;
		yeetIt = true;
	}
	return yeetIt;
}

/*============================================================================*/

export namespace Webhook {
	/**
	 * Runs a series of checks, if any fail, a peer++ eval will be required.
	 * @param hook The Intra webhook response.
	 * @return True if evaluation is required, false on error or none of the checks passed.
	 */
	export async function requiresEvaluation(hook: IntraWebhook.Root) {
		if (hook.user == null) {
			Logger.log("Ignored: ScaleTeam is a missing peer-evaluation one");
			return false;
		}
		if (hook.user.id == Config.botID) {
			Logger.log("Ignored: ScaleTeam evaluator is the bot itself");
			return false;
		}
		if (!Config.projects.find((p) => p.id === hook.project.id)) {
			Logger.log(`Ignored: ProjectID ${hook.project.id} is not in the list of projects`);
			return false;
		}

		// If not the last evaluation, then ignore.
		const evaluations = await Intra.getEvaluations(hook.project.id, hook.scale.id, hook.team.id);
		if (evaluations.length != hook.scale.correction_number - 1) {
			Logger.log(`Ignored: ${hook.team.name} did ${evaluations.length} / ${hook.scale.correction_number} evaluations.`);
			return false;
		}

		// NOTE (W2): Completely fucked up and weird endpoint btw.
		const teamUsers = await Intra.getTeamUsers(hook.team.id);
		return (await Checks.Evaluators(hook, evaluations, teamUsers)) || (await Checks.Random());
	}

	/**
	 * Send a notification / message to each user in the team.
	 * @param hook The Intra webhook response.
	 * @param text The message to send.
	 */
	export async function sendNotification(hook: IntraWebhook.Root, text: string) {
		const response = await Intra.api.get(`/teams/${hook.team.id}`);
		if (!response.ok) {
			throw new Error(`Failed fetch team ${hook.team.id} to send notification: ${response.statusText}`);
		}

		const Team = await response.json();
		for (const teamUser of Team.users) {
			const user = await getFullUser({ intraLogin: teamUser.login, intraUID: teamUser.id });

			await SlackBot.sendMessage(user, text);
			Logger.log(`Notified user: ${user.intraLogin}`);
		}
	}
}

/*============================================================================*/

export const webhookApp = express();

webhookApp.use(express.json());
webhookApp.use(express.urlencoded({ extended: true }));
webhookApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
	if (err.statusCode === 400 && "body" in err) {
		res.status(400).send({ status: 400, message: err.message });
	}
});

/*============================================================================*/

// TODO: Figure out how evaluation points should be handled.

// Runs whenever a ScaleTeam / Evaluation is created.
webhookApp.post("/create", async (req: Request, res: Response) => {
	Logger.log(JSON.stringify(req.headers));
	const hook: IntraWebhook.Root = req.body;
	const filter = await filterHook(req, Env.WEBHOOK_CREATE_SECRET);

	if (filter) {
		res.status(filter.code).send(filter.msg);
		return Logger.log(`Webhook: ${filter}`);
	}

	Logger.log(`Evaluation created: ${hook.team.name} -> ${hook.project.name}`);
	if (await blockPotentialEvaluation(hook)) {
		// 42 Being epic here :D
		const evaluations = await Intra.getEvaluations(hook.project.id, hook.scale.id, hook.team.id);
		const yeetEval = evaluations.find((value) => {
			return value.id == hook.id;
		});
		if (yeetEval != undefined) {
			await Intra.deleteEvaluation(yeetEval);
			res.status(200).send();
			return Logger.log(`Evaluation cancelled: These users shouldn't evaluate each other, yikes.`);
		}
	}

	try {
		if (await DB.exists(hook.team.id)) {
			// Team was already entered.
			Logger.log("Ignored: Create is from an expired team.");
		} else if (await Webhook.requiresEvaluation(hook)) {
			// Requires an evaluation.
			Logger.log("Booking a Peer++ evaluation!");

			// NOTE (W2): Because deleting a scale team does not give back the point later.
			// await Intra.givePointToTeam(hook.team.id);
			await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);
			await Webhook.sendNotification(
				hook,
				`Congratulations! Your \`${hook.project.name}\` has been selected for a Peer++ evaluation :trollface:\nFor more information visit: go.codam.nl`
			);
			SlackBot.notifyOfNewLock(hook.project.name);
			Logger.log("Booked a Peer++ evaluation, notified users!");
		} else {
			Logger.log("Ignored: Peer++ evaluation not required");
		}
	} catch (error) {
		res.status(500).send();
		return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
	}
	res.status(204).send();
});

/*============================================================================*/

// Runs whenever a ScaleTeam / Evaluation is destroyed.
webhookApp.post("/delete", async (req: Request, res: Response) => {
	Logger.log(JSON.stringify(req.headers));
	const hook: IntraWebhook.Root = req.body;
	const filter = await filterHook(req, Env.WEBHOOK_DELETE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return Logger.log(`Webhook: ${filter}`);
	}

	Logger.log(`Evaluation destroyed: ${hook.team.name} -> ${hook.project.name} -> ID: ${req.headers["x-delivery"]}`);
	if (hook.user && hook.user.id != Config.botID) {
		res.status(204).send();
		return Logger.log("Ignored: Webhook does not concern bot.");
	}

	try {
		await DB.exists(hook.team.id)
			.catch((reason) => {
				throw new Error(reason);
			})
			.then(async (value) => {
				if (value) {
					Logger.log("Ignored: Delete is from an expired team.");
				} else {
					Logger.log("Some student tried to cancel the bot", LogType.WARNING);
					if (await Webhook.requiresEvaluation(hook)) {
						Logger.log("Re-booking a Peer++ evaluation!");
					} else {
						Logger.log("Ignored: Peer++ evaluation not required");
						//Give a point back to the team ?
						// await Intra.givePointToTeam(hook.team.id);
						res.status(204).send();
						return;
					}
					await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);
					await Webhook.sendNotification(hook, "Nice try! You can't cancel Peer++ evaluations :trollface:");
					Logger.log(`Re-booked a placeholder evaluation for: ${hook.team.name} : ${hook.team.id}`);
				}
			});
	} catch (error) {
		res.status(500).send();
		return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
	}
	res.status(204).send();
});

/*============================================================================*/

// Runs whenever a ScaleTeam / Evaluation is changed in some way.
webhookApp.post("/update", async (req: Request, res: Response) => {
	Logger.log(JSON.stringify(req.headers));
	const hook: IntraWebhook.Root = req.body;
	const filter = await filterHook(req, Env.WEBHOOK_UPDATE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return Logger.log(`Webhook: ${filter}`);
	}

	Logger.log(`Evaluation update: ${hook.team.name} -> ${hook.project.name} -> ID: ${req.headers["x-delivery"]}`);

	try {
		const check = await DB.exists(hook.team.id);
		if (check) {
			res.status(204).send();
			return Logger.log("Ignored: Update is from an expired team.");
		}
	} catch (error) {
		res.status(500).send();
		return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
	}

	// Bot was marked as absent.
	if (hook.user && hook.user.id == Config.botID && hook.truant.id !== undefined) {
		try {
			// NOTE (W2): No need to delete the scaleteam here, the cronjob will take care of it.
			await DB.insert(hook.team.id);
		} catch (error) {
			res.status(500).send();
			return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
		}
		res.status(204).send();
		return Logger.log("Lock expired, user manually set the bot as absent.");
	}

	try {
		// If an evaluation is finished, failed and it was locked then remove the lock.
		const lock = (await Intra.getBotEvaluations()).find((lock) => lock.teamID == hook.team.id);

		if (lock != undefined && hook.final_mark != null && !(await Intra.markIsPass(hook.project.id, hook.final_mark))) {
			Logger.log(`Team ${lock.teamName} failed an evaluation, removing lock.`);

			await DB.insert(hook.team.id).catch((reason) => {
				throw new Error(reason);
			});
			await Intra.deleteEvaluation(lock);
			res.status(204).send();
			return await Webhook.sendNotification(hook, `Because you failed an evaluation, your Peer++ evaluation has been removed. Good luck next time :)`);
		}
		Logger.log("Ignored: User has not failed an evaluation or wasn't locked.");
	} catch (error) {
		res.status(500).send();
		return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
	}
	res.status(204).send();
});

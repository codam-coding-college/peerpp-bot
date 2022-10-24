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
import { IntraResponse, IntraWebhook } from "../utils/types";
import Logger, { LogType } from "../utils/logger";
import { Request, Response, NextFunction } from "express";
import * as Checks from "../checks/index";

/*============================================================================*/

/**
 * Filters for requests and sends back corresponding error.
 * @param req The incoming request.
 * @param secret The Webhook secret.
 * @returns Status code and error message.
 */
function filterHook(req: Request, secret: string) {
	// TODO: Check for duplicate delivery ID, sometimes intra is stupid and sends it twice.
	if (!req.is("application/json"))
		return { code: 400, msg: "Content-Type is not application/json" };
	if (!req.headers["x-delivery"])
		return { code: 400, msg: "X-Delivery header missing" };
	if (!req.headers["x-secret"])
		return { code: 400, msg: "X-Secret header missing" };
	if (req.headers["x-secret"] !== secret)
		return { code: 412, msg: "X-Secret header incorrect" };
	return null;
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
		if (!Config.projects.find(p => p.id === hook.project.id)) {
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
		const teamResponse = await Intra.api.get(`/teams/${hook.team.id}/teams_users`)
		if (!teamResponse.ok)
			throw new Error(`Failed to get team_users: ${teamResponse.statusText}`);
		const teamUsers = await teamResponse.json() as IntraResponse.TeamUser[];

		// Now do the regular checks.
		return (await Checks.Evaluators(hook, evaluations, teamUsers) || await Checks.Random());
	}

	/**
	 * Send a notification / message to each user in the team.
	 * @param hook The Intra webhook response.
	 * @param text The message to send.
	 */
	export async function sendNotification(hook: IntraWebhook.Root, text: string) {
		const response = await Intra.api.get(`/teams/${hook.team.id}`);
		if (!response.ok)
			throw new Error(`Failed to notify users: ${response.statusText}`);

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
	if (err.statusCode === 400 && "body" in err)
		res.status(400).send({ status: 400, message: err.message });
	next();
});

/*============================================================================*/

// TODO: Figure out how evaluation points should be handled.

// Runs whenever a ScaleTeam / Evaluation is created.
webhookApp.post("/create", async (req: Request, res: Response) => {
	const hook: IntraWebhook.Root = req.body;
	const filter = filterHook(req, Env.WEBHOOK_CREATE_SECRET);

	if (filter) { 
		res.status(filter.code).send(filter.msg);
		return Logger.log(`Webhook: ${filter}`);
	}

	Logger.log(`Evaluation created: ${hook.team.name} -> ${hook.project.name}`);

	try {
        await DB.exists(hook.team.id)
        .catch(reason => { throw new Error(reason); })
        .then(async (value) => {
            if (value)
			    Logger.log("Ignore: Created evaluation was from an expired team");
            else if (await Webhook.requiresEvaluation(hook)) {
                Logger.log("Booking a Peer++ evaluation!");
                await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);
                await Webhook.sendNotification(hook, `Congratulations! Your \`${hook.project.name}\` has been selected for a Peer++ evaluation :trollface:\nFor more information visit: go.codam.nl`);
                Logger.log("Booked a Peer++ evaluation, notified users!"); 
            }
            else
			    Logger.log("Ignore: Peer++ evaluation not required");
        });
	} catch (error) {
		res.status(500).send();
		return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
	}
	res.status(204).send();
});

/*============================================================================*/

// Runs whenever a ScaleTeam / Evaluation is destroyed.
webhookApp.post("/delete", async (req: Request, res: Response) => {
	const hook: IntraWebhook.Root = req.body;
	const filter = filterHook(req, Env.WEBHOOK_DELETE_SECRET);
	if (filter) { 
		res.status(filter.code).send(filter.msg);
		return Logger.log(`Webhook: ${filter}`);
	}

	Logger.log(`Evaluation destroyed: ${hook.team.name} -> ${hook.project.name}`);
	if (hook.user && hook.user.id != Config.botID) {
		res.status(204).send();
		return Logger.log("Ignored: Webhook does not concern bot.")
	}

	try {
        await DB.exists(hook.team.id)
        .catch(reason => { throw new Error(reason); })
        .then(async (value) => {
            if (value)
			    Logger.log("Ignore: Deleted evaluation was from an expired team");
            else {
                Logger.log("Some silly student tried to cancel the bot", LogType.WARNING);
                await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);
                await Webhook.sendNotification(hook, "Nice try! You can't cancel Peer++ evaluations :trollface:");
                Logger.log(`Reb-booked a placeholder evaluation for: ${hook.team.name} : ${hook.team.id}`);  
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
	const hook: IntraWebhook.Root = req.body;
	const filter = filterHook(req, Env.WEBHOOK_UPDATE_SECRET);
	if (filter) { 
		res.status(filter.code).send(filter.msg);
		return Logger.log(`Webhook: ${filter}`);
	}

	Logger.log(`Evaluation update: ${hook.team.name} -> ${hook.project.name}`);

	if (hook.user && hook.user.id != Config.botID) {
		res.status(204).send();
		return Logger.log("Ignored: Webhook does not concern bot.");
	}
	if (hook.truant.id !== undefined) {
		Logger.log("Lock expired, user manually set the bot as absent.")

		// NOTE (W2): No need to delete the scaleteam here, the cronjob will take care of it.
		try { await DB.insert(hook.team.id).catch((reason) => { throw new Error(reason); }) }
		catch (error) {
			res.status(500).send();
			return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
		}
	}
	
	try { // If an evaluation is finished, failed and it was locked then remove the lock.
		const lock = (await Intra.getBotEvaluations()).find(lock => lock.teamID == hook.team.id);
		if (lock != undefined && hook.final_mark && !await Intra.markIsPass(hook.project.id, hook.final_mark)) {

			await DB.insert(hook.team.id).catch((reason) => { throw new Error(reason); })
			
			const scaleResponse = await Intra.api.delete(`/scale_teams/${lock.id}`, {});
			if (!scaleResponse.ok)
				throw new Error(`Failed to delete lock: ${scaleResponse.statusText}`);

			// TODO: Notify user that lock has been removed.
		}
	} catch (error) {
		res.status(500).send();
		return Logger.log(`Something went wrong: ${error}`, LogType.ERROR);
	}
	res.status(204).send();
});
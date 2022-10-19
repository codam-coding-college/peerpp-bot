import express from "express";
import { Request, Response, NextFunction } from "express";
import { db } from "../app";
import { slackApp } from "../slackbot";
import { env } from "../utils/env";
import { Intra } from "../utils/intra/intra";
import Logger from "../utils/log";
import { IntraResponse } from "../utils/types";
import { Webhook } from "./evalRequirements";
import { ChatPostMessageArguments } from "@slack/web-api";
import { getFullUser } from "../utils/getUser";

/*============================================================================*/

/**
 * Filters for requests and sends back corresponding error.
 * @param req The incoming request.
 * @param secret The Webhook secret.
 * @returns Status code and error message.
 */
const filterHook = (req: Request, secret: string) => {
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

/**
 * Notifies the given team users that have been selected for a peer++ evaluation.
 * @param users The users to notify that they have been selected.
 * @param projectName The project that was selected.
 */
const sendNotification = async (hook: IntraResponse.Webhook.Root) => {
	try {
		const response = await Intra.api.get(`/teams/${hook.team.id}`);
		if (!response.ok)
			throw new Error(`Failed to notify users: ${response.statusText}`);

		const Team = await response.json();
		for (const teamUser of Team.users) {
			const user = await getFullUser({intraLogin: teamUser.login, intraUID: teamUser.id});

			const opt: ChatPostMessageArguments = {
				channel: user.slackUID,
				text: `Congratulations! Your \`${hook.project.name}\` has been selected for a Peer++ evaluation :trollface:\nFor more information visit: go.codam.nl`,
			};

			const response = await slackApp.client.chat.postMessage(opt);
			if (!response.ok)
				throw new Error(`Failed to send message: ${response.error}`);
			Logger.log(`Notified user: ${user.intraLogin}`);
		}
	} catch (error) { Logger.err(error); }
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

// Runs whenever a ScaleTeam / Evaluation is created.
webhookApp.post("/create", async (req: Request, res: Response) => {
	const hook: IntraResponse.Webhook.Root = req.body;
	const filter = filterHook(req, env.WEBHOOK_CREATE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return;
	}

	Logger.log(`Evaluation created: ${hook.team.name} -> ${hook.project.name}`);

	try {
		// Was the created evaluation from a Team that was marked as expired
		db.get(`SELECT * FROM expiredTeam WHERE teamID == ${hook.team.id}`, async (err, row) => {
			if (err != null)
				throw new Error(`Failed to check if team is in the db : ${err}`);
			else if (row != undefined) {
				Logger.log("Ignore: Created evaluation was from an expired team");
				res.status(204).send();
			}
			else if (await Webhook.requiresEvaluation(hook)) {
				Logger.log("Booking a Peer++ evaluation!");

				await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);
                await Intra.givePointToTeam(hook);
				await sendNotification(hook);

				res.status(201).send(`Peer++ placeholder evaluation created`);
			}
			else res.status(204).send("Peer++ evaluation not required");
		});	
	} catch (error) {
		Logger.err(error);
		res.status(500).send(error);
	}
});

/*============================================================================*/

// Runs whenever a ScaleTeam / Evaluation is destroyed.
webhookApp.post("/delete", async (req: Request, res: Response) => {
	const hook: IntraResponse.Webhook.Root = req.body;
	const filter = filterHook(req, env.WEBHOOK_DELETE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return;
	}

	Logger.log(`Evaluation destroyed: ${hook.team.name} -> ${hook.project.name}`);

	// Ignore if the corrector was not the bot
	if (hook.user && hook.user.id != env.PEERPP_BOT_UID) {
		Logger.log("Can be ignored, evaluation was not in regards to the bot.")
		res.status(204).send();
		return;
	}

	// Check if the team was marked with an expired lock.
	db.get(`SELECT * FROM expiredTeam WHERE teamID == ${hook.team.id}`, async (err, row) => {
		if (err != null) {
			Logger.err(`Failed to check if lock is in the db : ${err}`);
			res.status(500).send();
		}
		else if (row != undefined) {
			Logger.log("Cancelled evaluation was an expired one");
			res.status(204).send();
		}
		else {
			Logger.log("Some silly student tried to cancel the bot");
			try { await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);	
			} catch (error) {
				Logger.err(`Failed to rebook an evaluation : ${error}`);
				res.status(500).send();
				return;
			}
			res.status(204).send();
		}
	});
});

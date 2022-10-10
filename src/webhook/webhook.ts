/* ************************************************************************** */
/*                                                                            */
/*                                                        ::::::::            */
/*   webhook.ts                                         :+:    :+:            */
/*                                                     +:+                    */
/*   By: W2Wizard <w2.wizzard@gmail.com>              +#+                     */
/*                                                   +#+                      */
/*   Created: 2022/10/09 22:40:02 by W2Wizard      #+#    #+#                 */
/*   Updated: 2022/10/10 12:50:00 by lde-la-h      ########   odam.nl         */
/*                                                                            */
/* ************************************************************************** */

import express from "express";
import { Request, Response, NextFunction } from "express";
import { db } from "../app";
import { env } from "../utils/env";
import { Intra } from "../utils/intra/intra";
import Logger from "../utils/log";
import { IntraResponse } from "../utils/types";
import { Webhook } from "./evalRequirements";

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
	const filter = filterHook(req, env.WEBHOOK_DELETE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return;
	}

	Logger.log(`Evaluation created: ${hook.team.name} -> ${hook.project.slug}`);

	try {
		if (await Webhook.requiresEvaluation(hook)) {
			Logger.log("Booking a Peer++ evaluation!");

			await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id)
			res.status(201).send(`Peer++ placeholder evaluation created`);
			return;
		}
		res.status(204).send("Peer++ evaluation not required");
	} catch (error) {
		Logger.err(`Something went wrong: ${error}`);
		res.status(500).send(error);
	}
});

/*============================================================================*/

// Runs whenever a ScaleTeam / Evaluation is destroyed.
webhookApp.post("/delete", async (req: Request, res: Response) => {
	const hook: IntraResponse.Webhook.Root = req.body;
	const filter = filterHook(req, env.WEBHOOK_CREATE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return;
	}

	Logger.log(`Evaluation destroyed: ${hook.team.name} -> ${hook.project.slug}`);

	// Ignore the bot itself.
	if (hook.user && hook.user.id != env.PEERPP_BOT_UID) {
		Logger.log("Can be ignored, evaluation was not in regards to the bot.")
		res.status(204).send();
		return;
	}
	
	// Check if it was expired, and rebook if it wasn't
	db.get(`SELECT * FROM expiredLocks WHERE scaleteamID == ${hook.id}`, async (err, row) => {
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
			}
		}
	});
});

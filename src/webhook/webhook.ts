import express from "express";
import { Request, Response, NextFunction } from "express";
import { env } from "../utils/env";
import Logger from "../utils/log";
import { IntraResponse } from "../utils/types";
import { requiresEvaluation } from "./evalRequirements";
import { Intra } from "../utils/intra/intra";
import { db } from "../app";

// Helper functions
/* ************************************************************************** */

function filterHook(req: Request, secret: string): { code: number, msg: string } | null {
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

// Express setup
/* ************************************************************************** */

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
	if (err.statusCode === 400 && "body" in err)
		res.status(400).send({ status: 400, message: err.message });
	next();
});

// ScaleTeam - Create
/* ************************************************************************** */

app.post("/create", async (req: Request, res: Response) => {

	// TODO: Check if there are enough Peer++ evaluators to begin with.

	const filter = filterHook(req, env.WEBHOOK_CREATE_SECRET);
	if (filter) 
		return res.status(filter.code).send(filter.msg);

	try {
		const hook: IntraResponse.Webhook.Root = req.body;
		const create: boolean = await requiresEvaluation(hook);

		if (!create)
			return res.status(204).send("Peer++ evaluation not required");

		Logger.log("Booking a Peer++ evaluation!");
		
		// TODO: Uncomment to actually book evals and lock them.
		//await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id)

		return res.status(201).send(`Peer++ placeholder evaluation created`);
	} catch (err) {
		Logger.err(`Something went wrong: ${err}`);
		return res.status(500).send(err);
	}
});

// ScaleTeam - Delete
/* ************************************************************************** */

app.post("/delete", async (req: Request, res: Response) => {
	const filter = filterHook(req, env.WEBHOOK_DELETE_SECRET);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return;
	}
	
	const hook: IntraResponse.Webhook.Root = req.body;
	Logger.log(`Evaluation destroyed hook: ${hook.team.name}`);

	if (hook.user.id != env.PEERPP_BOT_UID) {
		Logger.logHook("ignored", hook, "Cancelled evaluation was not regarding the bot");
		res.status(204).send("Peer++ received");
		return;
	}

	// Was this evaluation marked as expired ?
	db.get(`SELECT * FROM expiredLocks WHERE scaleteamID == ${hook.id}`, (err, row) => {
		if (err != null) {
			Logger.err(`Failed to check if lock is in the db : ${err}`)
			res.status(500).send("Failed to check for lock in  db.");
		}
		else if (row != undefined) {
			Logger.logHook("ignored", hook, "Cancelled evaluation was an expired one");
			res.status(204).send("Peer++ received");
		}
		else { // Rebook the evaluation!
			Logger.logHook("ignored", hook, "Some silly student tried to cancel the bot");			
			try {
				// Because the cancellation leaves the slot behind ...
				// Intra.clearAllSlots();
				Intra.bookPlaceholderEval(hook.scale.id, hook.team.id);
			}
			catch (error) {
				Logger.logHook("error", hook, `Failed to rebook an evaluation! : ${error}`)
				res.status(500).send("Failed to rebook!");
			}
		}
	});
});

// ScaleTeam - Update
/* ************************************************************************** */

app.post("/update", async (req: Request, res: Response) => {

	const filter = filterHook(req, env.WEBHOOK_UPDATE_SECRET);
	if (filter) 
		return res.status(filter.code).send(filter.msg);

		const hook: IntraResponse.Webhook.Root = req.body;
		Logger.log(`Evaluation updated hook: ${hook.team.name}`);

	return res.status(204).send("Peer++ received");
});

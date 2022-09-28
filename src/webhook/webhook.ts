import express from "express";
import { Request, Response, NextFunction } from "express";
import { env } from "../utils/env";
import Logger from "../utils/log";
import { IntraResponse } from "../utils/types";
import { requiresEvaluation } from "./evalRequirements";

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

// Post
/* ************************************************************************** */

// ScaleTeam - Create
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
app.post("/delete", async (req: Request, res: Response) => {
	Logger.log("Evaluation destroyed");

	const filter = filterHook(req, env.WEBHOOK_CREATE_SECRET);
	if (filter) 
		return res.status(filter.code).send(filter.msg);
	return res.status(204).send("Peer++ received");
});

// ScaleTeam - Update
app.post("/update", async (req: Request, res: Response) => {
	Logger.log("Evaluation updated");

	const filter = filterHook(req, env.WEBHOOK_CREATE_SECRET);
	if (filter) 
		return res.status(filter.code).send(filter.msg);
	return res.status(204).send("Peer++ received");
});
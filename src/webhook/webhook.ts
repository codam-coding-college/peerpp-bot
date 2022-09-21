import express from "express";
import { Request, Response, NextFunction } from "express";
import { env } from "../env";
import { requiresEvaluation } from "./evalRequirements";
import { IntraResponse } from "../types";
import Logger from "../log";

// Helper functions
/* ************************************************************************** */

function filterHook(req: Request): { code: number; msg: string } | null {
	if (!req.is("application/json"))
		return { code: 400, msg: "Content-Type is not application/json" };
	if (!req.headers["x-delivery"])
		return { code: 400, msg: "X-Delivery header missing" };
	if (!req.headers["x-secret"])
		return { code: 400, msg: "X-Secret header missing" };
	if (req.headers["x-secret"] !== env.WEBHOOK_SECRET)
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

app.post("/webhook", async (req: Request, res: Response) => {
	const filter = filterHook(req);
	if (filter) 
		return res.status(filter.code).send(filter.msg);

	try {
		const hook: IntraResponse.Webhook.Root = req.body;
		const create: boolean = await requiresEvaluation(hook);

		if (!create)
			return res.status(204).send("Peer++ evaluation not required");

		// TODO: Uncomment to actually book evals
		// await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id)

		return res.status(201).send(`Peer++ placeholder evaluation created`);
	} catch (err) {
		Logger.err("Something went wrong ...");
		return res.status(500).send(err);
	}
});

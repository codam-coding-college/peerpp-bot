import express from "express";
import { env } from "../env";
import { shouldCreatePeerppEval } from "./shouldCreatePeerppEval";
import { logErr } from "../log";
import { IntraResponse } from "../types";

export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((err, req, res, next) => {
	// @ts-ignore
	if (err instanceof SyntaxError && err.statusCode === 400 && "body" in err) {
		// @ts-ignore
		return res.status(400).send({ status: 400, message: err.message });
	}
	next();
});

function filterHook(req): { code: number; msg: string } | null {
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

app.post("/webhook", async (req, res) => {
	const filter = filterHook(req);
	if (filter) {
		res.status(filter.code).send(filter.msg);
		return;
	}

	try {
		const hook: IntraResponse.Webhook.Root = req.body;
		const create: boolean = await shouldCreatePeerppEval(hook);
		if (!create)
			return res.status(204).send("Peer++ evaluation not required");

		// await Intra.bookPlaceholderEval(hook.scale.id, hook.team.id) // TODO: uncomment

		return res.status(201).send(`Peer++ placeholder evaluation created`);
	} catch (err) {
		logErr(err);
		return res.status(500).send(err);
	}
});

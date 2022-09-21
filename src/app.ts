import Fast42 from "@codam/fast42";
import util from "util";
import { env } from "./env";
import { Intra } from "./intra/intra";
import Logger from "./log";
import { app as slackApp } from "./slack/slack";
import { app as webhookApp } from "./webhook/webhook";

/* ************************************************************************** */

// Set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

/* ************************************************************************** */

(async () => {
	Logger.log("Launching Peer++");
    
    Intra.api = await new Fast42([{
        client_id: env.INTRA_UID,
        client_secret: env.INTRA_SECRET
    }]).init()

	Logger.log("Connected to Intra V2");

	await slackApp.start();
	await webhookApp.listen(8080);
    Logger.log("Express backend running");
})();

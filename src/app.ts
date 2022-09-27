import util from "util";
import Logger from "./utils/log";
import { env } from "./utils/env";
import Fast42 from "@codam/fast42";
import { Intra } from "./utils/intra/intra";
import { app as webhookApp } from "./webhook/webhook";
import { slackApp } from "./slackbot/slack";

/* ************************************************************************** */

// Set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

/* ************************************************************************** */

(async () => {
	Logger.log("Launching Peer++");
    
    Intra.api = await new Fast42([{
        client_id: env.INTRA_UID,
        client_secret: env.INTRA_SECRET
    }]).init();

	Logger.log("Connected to Intra V2");

    await webhookApp.listen(8080);
	await slackApp.start().catch((error) => {
        Logger.err("Slack bot failed to start.");
        return;
    });

    Logger.log("Running ...");
})();

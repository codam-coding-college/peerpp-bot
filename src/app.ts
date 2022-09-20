import util from "util";
import { app as slackApp } from "./slack/slack";
import { app as webhookApp } from "./webhook/webhook";

/* ************************************************************************** */

// Set depth of object expansion in terminal to unlimited
util.inspect.defaultOptions.depth = null;

(async () => {
	await slackApp.start();
	webhookApp.listen(8080);
})();

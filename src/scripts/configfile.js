// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022-2026.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

// Config loading shared by the scripts in this folder.

const fs = require("fs");
const dotenv = require("dotenv");

//===================================================//

function readConfigFile(path, hint) {
	try {
		return fs.readFileSync(path).toString();
	} catch (error) {
		if (error.code !== "ENOENT") throw error;

		console.error(`Missing config file: ${path}`);
		console.error(hint);
		process.exit(1);
	}
}

/** Reads the secrets from config/.env. */
function readEnv() {
	return dotenv.parse(readConfigFile("./config/.env", "Copy config/.env-example to config/.env and fill in the values, and run the script from the repository root."));
}

/** Reads the bot configuration from config/config.json. */
function readConfig() {
	return JSON.parse(readConfigFile("./config/config.json", "config/config.json is part of the repository. Run the script from the repository root."));
}

module.exports = { readConfig, readEnv };

//===================================================//

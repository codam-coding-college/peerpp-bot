// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

// Script to fetch all current users in the specified group id in the config.

const fs = require("fs");
const fast42 = require("@codam/fast42");
const dotenv = require("dotenv");

//===================================================//

// 18176 LibftScale

const args = process.argv.slice(2);
const env = dotenv.parse(fs.readFileSync("./config/.env"));

//===================================================//

(async () => {
	if (args[0] === undefined || args[1] === undefined || args[2] === undefined)
		return console.error("Invalid usage: <scaleID> <teamID> <userID>");

	const api = await new fast42.default([{
		client_id: env["INTRA_UID"],
		client_secret: env["INTRA_SECRET"]
	}]).init();

	const evaluationDate = new Date(Date.now() + (60 * 1000));
	const body = {
		scale_teams: [
			{
				begin_at: evaluationDate.toISOString(),
				scale_id: args[0],
				team_id: args[1],
				user_id: 111044,
			},
		],
	};

	const scaleTeamResponse = await api.post("/scale_teams/multiple_create", body);
	if (!scaleTeamResponse.ok)
		throw new Error(`Failed to book evaluation ${scaleTeamResponse.statusText}`);
	console.log('Created an evaluation')
})();
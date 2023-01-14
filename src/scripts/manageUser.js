// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

// Script to add or remove users from the group defined in the config.

const fs = require("fs");
const fast42 = require("@codam/fast42");
const dotenv = require("dotenv");

//===================================================//

const args = process.argv.slice(2);
const env = dotenv.parse(fs.readFileSync("./config/.env"));
const config = JSON.parse(fs.readFileSync("./config/config.json").toString());

//===================================================//

(async () => {
	if (!["add", "remove"].includes(args[0]) || args[1] == undefined) {
		return console.error("Invalid usage: add | remove <user>");
	}

	const api = await new fast42.default([
		{
			client_id: env["INTRA_UID"],
			client_secret: env["INTRA_SECRET"],
		},
	]).init();

	const userResponse = await api.get(`/users/${args[1]}`);
	if (!userResponse.ok) return console.error(`Intra failed to get user: ${userResponse.statusText}`);
	const user = await userResponse.json();

	switch (args[0]) {
		case "add": {
			const groupAddResponse = await api.post("/groups_users", {
				groups_user: {
					group_id: config.groupID,
					user_id: user.id,
				},
			});

			if (groupAddResponse.status == 201) {
				return console.log("User Added!");
			} else if (groupAddResponse.status == 422) {
				return console.log("User was already added");
			}
			return console.error(`Intra failed to add user: ${userResponse.statusText}`);
		}

		case "remove": {
			const groupsResponse = await api.get(`/users/${user.id}/groups_users`);
			if (!groupsResponse.ok) {
				return console.error(`Intra failed to get group data: ${groupsResponse.statusText}`);
			}

			const groupUsers = await groupsResponse.json();
			for (const groupUser of groupUsers) {
				if (groupUser.group.id != config.groupID) {
					continue;
				}

				const deletionResponse = await api.delete(`/groups_users/${groupUser.id}`);
				if (deletionResponse.status != 204) {
					return console.error(`Intra failed to delete group user: ${groupsResponse.statusText}`);
				}
				return console.log("User removed!");
			}
			return console.log("User was not in group!");
		}
	}
})();

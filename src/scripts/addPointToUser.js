const fs = require("fs");
const fast42 = require("@codam/fast42");
const dotenv = require("dotenv");

//===================================================//

const args = process.argv.slice(2);
const file = dotenv.parse(fs.readFileSync(".env"));

//===================================================//

(async () => {
	if (args[0] == undefined)
		return console.error("Invalid usage: <user>");

    const api = await new fast42.default([{
		client_id: file["INTRA_UID"],
        client_secret: file["INTRA_SECRET"]
    }]).init();

    const userResponse = await api.get(`/users/${args[0]}`);
    if (!userResponse.ok)
        return console.error(`Failed to fetch user: ${userResponse.statusText}`);

    const userData = await userResponse.json();
    console.log(`Found user: ${userData.login}`)

    const pointRemResponse = await api.delete(`/pools/39/points/remove`, {"points": 1});
    if (!pointRemResponse.ok)
        return console.error(`Failed to remove evalpoint from pool: ${pointRemResponse.statusText}`);

    const pointResponse = await api.post(`/users/${userData.id}/correction_points/add`, { "reason": "Because we said so." });
    if (!pointResponse.ok)
        return console.error(`Failed to give point to user: ${pointResponse.statusText}`);
    console.log("Point given!");
})();

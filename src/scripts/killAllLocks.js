const fs = require("fs");
const fast42 = require("@codam/fast42");
const dotenv = require("dotenv");

//===================================================//

const file = dotenv.parse(fs.readFileSync(".env"));

//===================================================//

(async () => {
    const api = await new fast42.default([{
		client_id: file["INTRA_UID"],
        client_secret: file["INTRA_SECRET"]
    }]).init();

    const pages = await api.getAllPages(`/users/${file["PEERPP_BOT_UID"]}/scale_teams`, {
        "filter[future]": "true",
        "filter[campus_id]": `${file["WATCHED_CAMPUS"]}`
    });

    let n = 0;
    for await (const page of pages) {
        if (!page.ok) {
            console.error(`Failed to get evaluation locks with status ${page.status}`);
            continue;
        }

        // Convert Evaluation to a simplified ScaleTeam
        const scaleTeams = await page.json()
        for (const scaleTeam of scaleTeams) {
            const deleteResponse = await api.delete(`/scale_teams/${scaleTeam.id}`, {});
            if (!deleteResponse.ok)
                return console.error(`Intra decided to fail: ${deleteResponse.statusText}`);
            console.log(`Deleted lock: ${scaleTeam.id} : ${scaleTeam.team.name}`);
            n++;
        }
    }
    console.log(`Deleted locks: ${n}`);
})();

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

    const groupsResponse = await api.getAllPages(`/groups/${file["PEERPP_GROUP_ID"]}/groups_users`);
    await Promise.all(groupsResponse).catch((reason) => {
        return console.error(`Failed to get groups: ${reason}`);
    });

    const users = [];
    for await (const page of groupsResponse) {
        if (!page.ok)
            return console.error(`Failed to fetch group users: ${page.statusText}`);
        const groupUsers = await page.json();
        
        for (const user of groupUsers)
            users.push(user.user_id);
    }

    const userResponse = await api.getAllPages(`/users`, {
        "filter[id]": users.join(',') 
    });

    for await (const page of userResponse) {
        if (!page.ok)
            return console.error(`Failed to fetch user: ${page.statusText}`);
        const usersPage = await page.json();
        
        for (const user of usersPage)
            console.log(user.login)
    }

})();

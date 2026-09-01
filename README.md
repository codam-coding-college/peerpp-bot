</br>
<div align="center">
  <img width=420 src="https://user-images.githubusercontent.com/63303990/186118455-d1a2c167-702d-4be9-8e9e-08f3b7791902.png" alt="Logo">
</div>
<div align="center">
  <sub>Written by <a href="https://github.com/joppekoers/">Joppe</a>, <a href="https://portfolio.w2wizard.dev/">W2.Wizard</a> & <a href="https://github.com/FreekBes/">Freek</a> for Codam Coding College</sub>
</div>
</br>

## What is the Peer++ system?
The Peer++ evaluation system ensures quality evaluations by matching students with high-level evaluators.

Read more about it in [ABOUT.md](ABOUT.md).

---

## Installation
Convert `./config/.env-example` to `.env` and fill in the secret data.

By default port `8080` is used for the webhooks express server.

The slackbot runs over Websockets instead of HTTP Requests, so it does not listen on a port.

### Development
1. Install NodeJS 20.x or higher (the production container runs NodeJS 26).
2. Install dependencies: `npm install`
3. Initialize the database: `npm run init-db` (requires the `sqlite3` CLI).
4. Use `npm run dev` for development mode.

### Production
In production environments, use Docker.

- Use `make up` to run in a docker container.
- Use `make down` to shut down the docker container.

Or, if you're confident in your Docker skills, you can just use the `docker compose` command directly.

#### Logrotate
In production, we recommend setting up a logrotate in the `logs` directory.
Create a logrotate config in the `/etc/logrotate.d` folder.

You can use or modify the configuration below:
```
/root/peer-bot/logs/log.txt {
        weekly
        missingok
        rotate 4
        compress
        delaycompress
        shred
        ifempty
        create 644 root root
}
```

---

## Useful how-tos
### Add a user to the Peer++ group
1. Go to the `peer-bot` directory.
2. Run `node src/scripts/manageuser.js add <login>` where `<login>` is the login of the user you want to add to the Peer++ group.

### Remove a user from the Peer++ group
1. Go to the `peer-bot` directory.
2. Run `node src/scripts/manageuser.js remove <login>` where `<login>` is the login of the user you want to remove from the Peer++ group.

### List all users in the Peer++ group
1. Go to the `peer-bot` directory.
2. Run `node src/scripts/getusers.js`.

### Manually schedule a Peer++ evaluation
1. Go to the `peer-bot` directory.
2. Run `node src/scripts/bookeval.js <scaleID> <teamID> <userID>` where `<scaleID>` is the scaleID of the scale you want to use for the evaluation, `<teamID>` is the teamID of the team you want to schedule an evaluation for and `<userID>` is the userID of the evaluator (the one evaluating the team).

### Allow cancellation of a Peer++ evaluation
1. Go to the `peer-bot` directory.
2. Run `sqlite3 db/peerdb.sqlite`.
3. Run `INSERT INTO expiredTeam(teamID) VALUES ('<teamID>');` in the sqlite3 shell, where `<teamID>` is the teamID of the team you want to cancel the evaluation for.
4. Run `.exit` to exit the sqlite3 shell.
5. Tell the team that they can now cancel the evaluation (make them press x next to the evaluation on the Intranet).
6. Run `node src/scripts/addpoint.js <login>` where `<login>` is the login of the student who lost an evaluation point for the cancellation. This will refund the point to the student.

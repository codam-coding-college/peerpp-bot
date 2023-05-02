</br>
<div align="center">
  <img width=420 src="https://user-images.githubusercontent.com/63303990/186118455-d1a2c167-702d-4be9-8e9e-08f3b7791902.png" alt="Logo">
</div>
<div align="center">
  <sub>Written by <a href="https://github.com/SirMorfield/">Joppe</a> & <a href="https://portfolio.w2wizard.dev/">W2.Wizard</a> for Codam Coding College </sub>
</div>
</br>

## What is the Peer++ system?
The peer++ evaluation system ensures quality evaluations by matching students with high-level evaluators.

Read more about it [here](https://codam.notion.site/Peer-Evaluations-810cdd6714074f1b881fc8d4e54e5e5f).

---

## Installation
Convert `./config/env-example` to `.env` and fill in the secret data.

By default port `8080` is used for the webhooks express server
and port `3000` is used for the slack bot using the slack bolt api.

The slackbot runs over Websockets instead of HTTP Requests.

## Local development

1. Install NodeJS 18.x or higher.
2. Install dependencies: `npm install`
3. Use `npm run dev` for development mode.

## Production
When using the container, configure the paths to your liking.

1. Use `make up` to run in a docker container.
2. Use `make down` to shut down the docker container.

---

## How do I fix little oopsies ?
Sometimes it can happen that students need to have their special
moments where they can't do a Peer++ evaluation.

To fix things like:

### "I want points back!"
If they want to be given back a few points the following script adds 1 point from the pool: `node src/scripts/addPoint.js <user name>`


### "I need to do this eval now or my deadlines will fuck me!"
Do `sqlite3 db/peerdb.sqlite` then `INSERT INTO expiredTeam(teamID) VALUES(<teamID>)`. To get the TeamID just check the logs or got intra. Tell them to then simply cancel the bot, decide if they can the point back or not.

---

### Virtual Machine

We recommend setting up a log rotate in the `logs` directory.
To find or create log rotations go to `/etc/logrotate.d`.

You can use the configuration below:
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

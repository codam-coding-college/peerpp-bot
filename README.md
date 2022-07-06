# Peer++ bot
The peer++ evaluation system ensures quality evaluations by matching students with high-level evaluators.
It does this by blocking students from planning their last evaluation of their project if the previous evaluations were not of sufficient quality. Then a Peer++ evaluator will be assigned give a high-quality evaluation.

![img](doc/flowchart.png)

# Installation
Copy `./env-example` to `.env` and fill in the secret data
```
port 8080  is listening for webhooks on a express server
port 3000  is used to receives slack messages on the slack bolt api
```

## Docker (production)
```
docker build -t peerpp-bot .
docker stop peerpp-bot || true
docker rm peerpp-bot || true
docker run -d --restart unless-stopped -p 8080:8080 -p 3000:3000 --name peerpp-bot peerpp-bot
```

## Local development
- Install Nodejs 18.x
- Install dependencies\
`npm install`
- Option 1: Start development\
`npm run dev`
- Option 2: Start production\
`npm run build`\
`npm run start`


# Names used internally
For user indentification the progam uses the `User` object which contains the matched information form both slack (eg. slackUID) and intra (eg. intraLogin) to have a single object to pass around.
Generating this object does take a couple requests, so you can alternatively opt for using the `IncompleteUser` to pass around. But be careful, it might happen that a `IncompleteUser` can not be converted to a `User` so you have to catch that error somewhere that makes sense, not halfway during the creation of a eval for example.

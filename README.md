# Peer++ bot

## What is the Peer++ system?
The peer++ evaluation system ensures quality evaluations by matching students with high-level evaluators.

It does this by blocking students from planning their last evaluation of their project if the previous evaluations were not of sufficient quality.
Then a Peer++ evaluator will be assigned give a high-quality evaluation.

---

## As an Evaluator

For any additional information you can simply *type* `help` to the bot and it will display the available commands.

They process works as follows to start an evaluation:
1. Go on slack and enter into a direct message with the `Peerplusplus` App/Bot.
2. *Type* `list-projects` to find the projects that **can** be evaluated.
3. *Type* `list-evaluations` to inspect available Peer++ evaluation slots.
4. *Type* `book-evaluation <PROJECT_NAME>` to book the *oldest available* slot.
5. Profit!

Once the `book-evaluation` command executes it will find the oldest available slot and swap the
locked evaluation out with yours. You and the evaluatee have to discuss on when to actually do the evaluation.

Afterwards a normal evaluation happens and everything moves on.

### How to become a Peer++ Evaluator
Simply inform staff about your request on slack or walk into bocal.
You will be added to the Peer++ group and get a fancy tag on intra to display it, similar to the C.A.T. group.

---

## As an Evaluatee

As you're doing your evaluations for a project, once you reach the last evaluation and try to book it. The bot will book it instead of the slot you selected and hold onto it for a certain amount of days. This essentially locks you from booking any regular evaluations.

Within a day a Peer++ evaluator will book the slot and the bot swaps out its lock with a proper evaluation.
However if it takes longer than a day for a peer++ member to book you the lock expires and the bot will never again
bother you or lock your last evaluation.

NOTE: ***ANY*** attempt trying to cancel the bot will simply cause it to re-lock your last slot, lose a point and reset the counter. So don't try to bypass the lock!

---

# Installation
Copy `./env-example` to `.env` and fill in the secret data
```
port 8080 is listening for webhooks on a express server
port 3000 is used to receives slack messages on the slack bolt api
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

# Peer++ Evaluations

The Peer++ evaluation system ensures the quality of evaluations by matching students with high-level evaluators in the core curriculum.
Its goal is to discourage cheating in evaluations, keep the focus on the code, and make evaluations instructive.

This is achieved with the Peer++ Slackbot, which reserves ("locks") the last evaluation of your project when it deems it necessary.
Its decision is based on the quality of your previous evaluations — for example, when every previous evaluator was of a low level.

---

## When does the bot lock an evaluation?

The bot only considers projects from the core curriculum that are on its list — run `/projects` in the Slackbot to see the current list.

When your team books its second-to-last evaluation, the bot checks the evaluations you have had so far.
Your last slot is **not** locked if any of the following is true:

- one of your correctors was at least **2 levels above** the team leader;
- one of your correctors had **completed the project** themselves;
- a previous evaluation was a **fail**;

If none of those apply, the bot reserves your final evaluation slot and you have to wait for a Peer++ evaluator to pick you up.
Evaluations where the corrector was marked absent do not count towards this check.

> **NOTE:** the bot can also be configured to lock a small percentage of evaluations at random.

---

## Being evaluated

Once your last evaluation is locked, you cannot continue with regular evaluations for that project.
You will need to wait for a Peer++ evaluator to book you. This may take some time, but be patient — someone will usually come along.

When a Peer++ evaluator books you, you are notified on Slack with their name.
From that point it is up to the two of you to agree on when to do the evaluation. It may be in 20 minutes or tomorrow.

### If nobody books you

The lock lasts **1 day**. After that the bot removes it and ignores that project attempt from then on,
so you can continue with your regular evaluations without the bot interfering.

If you fail the project and retry it, the bot can lock the last evaluation of the new attempt again.

### Do not try to cancel it

Cancelling the bot's evaluation does not get rid of it. The bot notices, immediately re-books your last slot,
and puts you back in the queue. You are better off waiting.

The evaluation point taken for cancelling the evaluation will not be returned.

---

## Becoming a Peer++ evaluator

Inform the Codam Pedago team that you want to become a Peer++ evaluator.

Once you are added you get a Peer++ tag on your profile. That tag is what the bot uses to recognise evaluators —
without it, the evaluator commands will not work for you.

---

## Commands

| Command | Who can use it | Description |
| --- | --- | --- |
| `/projects` | everyone | Show which projects the bot can lock evaluations for, with your favorites marked. |
| `/evaluations` | everyone | Show all teams waiting for a Peer++ evaluation that can be booked. |
| `/book <project_name>` | Peer++ evaluators | Book one of the available evaluations for that project. |
| `/notify-on <project_name>` | Peer++ evaluators | Mark a project as favorite, and get notified when a team is waiting for a Peer++ evaluation on it. |
| `/notify-off <project_name>` | Peer++ evaluators | Remove a project from your favorites and stop being notified of its waiting teams. |
| `/notify-on-all` | Peer++ evaluators | Make every project a favorite, get notified of every team waiting for a Peer++ evaluation. |
| `/notify-off-all` | Peer++ evaluators | Remove all your favorites and stop being notified entirely. |
| `/evaluators` | Peer++ evaluators | Show which evaluators are notified of teams waiting for a Peer++ evaluation, per project. |

### Booking an evaluation

1. Run `/projects` to see which projects the bot handles.
2. Run `/evaluations` to see what is currently available, and how long each has been waiting.
3. Run `/book <project_name>` to take one.
4. The bot picks the team that has been waiting the longest, swaps out its reservation for yours,
   and messages both you and the team.
5. Agree on a time with the team and conduct the evaluation.

You cannot book an evaluation for your own team.

### Favorites

Rather than polling `/evaluations`, mark the projects you enjoy evaluating as favorites:

```
/notify-on libft
/notify-on push_swap
```

From then on the bot messages you as soon as a team is waiting for a Peer++ evaluation on one of those projects — and only those.
You can favorite as many as you like, and `/notify-off <project_name>` removes one again.
Both commands need a project name, which has to be one from `/projects`.

Want everything, or nothing at all?

| | |
| --- | --- |
| `/notify-on-all` | favorites every project at once |
| `/notify-off-all` | clears all your favorites and stops every notification |

Running `/projects` shows the full list with a :star: next to the ones you have favorited,
and `/evaluators` shows which evaluators are watching which project — handy for spotting
projects nobody is covering, or finding out who to ask about one.

---

## The Hitchhiker's Guide to evaluating

As a Peer++ evaluator you are responsible for making sure the quality of the project is of a high standard,
and you rely on your own expertise to keep it that way.

Use testers to check that the project handles all sorts of edge cases. Read the code as well, and ask about it:
why were certain decisions made, and can the student explain the concepts correctly?

Peer++ evaluations exist to raise the standard students hold themselves to.
They are **not** an opportunity to burn anyone to the ground.

You can be strict and kind at the same time. There is never a need to be degrading or disrespectful.

---

If you run into bugs or issues, please let the Pedago team know.

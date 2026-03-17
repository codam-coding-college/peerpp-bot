# Peer++ Evaluations

The peer++ evaluation system ensures the quality of evaluations by matching students with high-level evaluators in the core curriculum.
This is to mainly prevent cheating in evaluations and also focus on the code and to have instructive evaluations.

This is achieved with the peer++ slackbot which locks the last evaluation of your project if it deems it necessary.
Its decision is influenced by the quality of the previous evaluations, e.g: level of the previous evaluators being too low.


## How to become a Peer++ Evaluator
Simply inform the Pedago team that you want to be a Peer++ evaluator, you need to be at-least on Rank04 to apply.

Once added, you get a fancy tag Peer++ on your profile. This tag is actually important as its used to identify peer++ evaluators.
If you do not have this tag you can't request a evaluation via the bot.


## The Hitchhiker's Guide to evaluating
As a peer++ evaluator you're responsible to ensuring that the quality of the project is of a high standard and rely on your own expertise to make sure this stays true.

You can use testers to make sure that the project covers all sorts of edge cases. Make sure to actually also read the code and ask questions about it, why did they make certain decisions and if they can explain concepts correctly.

The Peer++ Evals are done to increase the standards set by the students. It's NOT an opportunity to burn them to the ground.

You can be strict and nice at the same time. There is no need to be degrading or otherwise disrespectful of anyone.

### Booking an evaluation

All available commands:

| Command | Description |
| --- | --- |
| /projects | Display which projects can be evaluated. |
| /book <project_name> | Book an available evaluation of a certain project. |
| /evaluations | Display all currently available evaluations that can be booked. |

So the procedure for using the book is as follows:
1. Type `/projects` to find out which projects are possible to evaluate.
2. Type `/evaluations` to see wha evaluations are currently available.
3. Type `/book <PROJECT_NAME>` to book an available evaluation.
4. Wait for the bot to match you with a student.
5. Profit!

Once the `/book` command has executed it will find the oldest locked slot and swaps out its reserved evaluation with yours.
The bot messages both parties that they have been matched and its up the both evaluator and evaluatee to discuss on when to conduct the evaluation.


## The Hitchhiker's Guide to being evaluated
Once you book your second to last evaluation, the bot will check the previous evaluators and see if they were of high quality.
If this check fails your last evaluation gets reserved by the bot and essentially "locked” meaning you cannot continue with regular evaluations.

This means you need to wait that a Peer++ evaluator books you, this may take some time but be patient, someone will most likely come and book you.
If you do get booked by a Peer++ evaluator, you will be notified again about who it is and that you must communicate on when to do it.
It may be in 20 minutes or tomorrow, it’s up to you two to figure this out.

The lock lasts only 1 day, after which the bot will remove the lock and completely ignore the project in the future.
However if you fail and retry the bot will be able to lock your last evaluation again.

> **NOTE:** ***ANY*** attempt trying to cancel the bot's lock / evaluation will simply cause it to re-lock your last slot, lose a point,
> put you back on the queue and reset the counter. So don't try it 😉

If you encounter any bugs or issues please inform the pedago team about it.

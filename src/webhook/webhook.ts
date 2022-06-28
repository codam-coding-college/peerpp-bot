import { log, logErr } from '../log'
import express from 'express'
import { env } from '../env'
import { getFullUser } from '../getUser'
import { Intra } from '../intra/intra'
import fs from 'fs'
import { IntraResponse } from '../types'
import { User } from '../types'


export const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((err, req, res, next) => {
	// @ts-ignore
	if (err instanceof SyntaxError && err.statusCode === 400 && 'body' in err) {
		// @ts-ignore
		return res.status(400).send({ status: 400, message: err.message })
	}
	next()
})

// Only check if a peer++ evaluation is required if the second-to-last evaluation has been completed
// Get amount of evals required from the last one (if the amount has been changed during hand-in of the project,
// this eval is the last one done, so the number will likely be most up-to-date)
async function shouldCreatePeerppEval(hook: IntraResponse.Webhook.Root): Promise<boolean> {
	if (!env.projects.find(p => p.id === hook?.project?.id)) {
		log(`hook | not required | projectid ${hook.project.id} is not in the list of projects`)
		return false
	}

	let evals: IntraResponse.Evaluation[] = []
	try {
		evals = await Intra.getEvaluations(hook.team.project_id, hook.scale.id, hook.team.id)
	} catch (err) {
		logErr(`shouldCreatePeerppEval | ${err} | ${JSON.stringify(hook)}`)
		return false
	}
	if (evals?.length === 0) {
		log(`hook | not required | project has no evaluations completed`)
		return false
	}

	// TODO: check if previous evals were passed
	// TODO: ignore books form peer++ bot

	// only do check for peer++ eval if this is the second to last evaluation
	const nEvalsRequired = hook.scale.correction_number
	if (nEvalsRequired - 1 != evals.length) {
		log(`hook | not required | user did ${evals.length}, of the required ${nEvalsRequired} evals`)
		return false
	}

	try {
		const corrected: User = await getFullUser({ intraUID: hook.user.id, intraLogin: hook.user.login })
		console.log({ intraUID: hook.user.id, intraLogin: hook.user.login })
		for (const evalu of evals) {
			const corrector: User = await getFullUser({ intraUID: evalu.corrector.id, intraLogin: evalu.corrector.login })
			if (corrector.level - 2 > corrected.level) {
				log(`hook | not required | corrector ${corrector} level is high enough`)
				return false
			}
		}
		log(`hook | required | booking evaluation for : ${corrected.intraLogin}'s team`)
		return true
	} catch (err) {
		logErr(`shouldCreatePeerppEval 2 | ${err}`)
		return false
	}
}

// shouldCreatePeerppEval(JSON.parse(fs.readFileSync('src/webhook/webhookExample.json').toString())).then((a) => {
// 	console.log(a)
// })

app.post('/webhook', async (req, res) => {
	if (!req.is('application/json'))
		return res.status(400).send('Content-Type is not application/json')
	if (!req.headers['x-delivery'])
		return res.status(400).send('X-Delivery header missing')
	if (!req.headers['x-secret'])
		return res.status(400).send('X-Secret header missing')
	if (req.headers['x-secret'] !== env.WEBHOOK_SECRET)
		return res.status(412).send('X-Secret header incorrect')
	console.log(JSON.stringify(req.body))

	// return res.status(200).send('OK')
	// TODO: actually create evaluation
	const create: boolean = await shouldCreatePeerppEval(req.body)
	return res.status(create ? 201 : 204).send('')
})

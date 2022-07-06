import express from 'express'
import { env } from '../env'
import { shouldCreatePeerppEval } from './shouldCreatePeerppEval'

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

function filterHook(req): { code: number, msg: string } | null {
	if (!req.is('application/json'))
		return { code: 400, msg: 'Content-Type is not application/json' }
	if (!req.headers['x-delivery'])
		return { code: 400, msg: 'X-Delivery header missing' }
	if (!req.headers['x-secret'])
		return { code: 400, msg: 'X-Secret header missing' }
	if (req.headers['x-secret'] !== env.WEBHOOK_SECRET)
		return { code: 412, msg: 'X-Secret header incorrect' }
	return null
}

app.post('/webhook', async (req, res) => {
	const filter = filterHook(req)
	if (filter) {
		res.status(filter.code).send(filter.msg)
		return
	}

	// return res.status(200).send('OK')
	// TODO: actually create evaluation
	const create: boolean = await shouldCreatePeerppEval(req.body)
	return res.status(create ? 201 : 204).send('')
})

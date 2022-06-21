import express from 'express'
import { env } from '../env'

export const app = express()
app.use(express.json())
app.use(express.urlencoded({extended: true}))

// returns true when a eval was created
async function createEval(json: any): Promise<boolean> {
	console.log(json)
	return false
}

app.post('/webhook', async (req, res) => {
	if (!req.is('application/json'))
		return res.status(400).send('Content-Type is not application/json')
	if (!req.headers['X-Delivery'])
		return res.status(400).send('X-Delivery header missing')
	if (!req.headers['X-Secret'])
		return res.status(400).send('X-Secret header missing')
	if (req.headers['X-Secret'] !== env.WEBHOOK_SECRET)
		return res.status(412).send('X-Secret header missing')

	const created: boolean = await createEval(req.body);
	if (created)
		return res.status(201).send()
	else
		return res.status(204).send()

})

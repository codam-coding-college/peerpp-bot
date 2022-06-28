import fs from 'fs'

export function nowISO(d?: Date): string {
	if (!d)
		d = new Date()
	return `${d.toISOString().slice(0, -5)}Z`
}

fs.mkdirSync('logs', { recursive: true })

export async function log(line: string) {
	console.log(`${nowISO()} | ${line}`)
	await fs.promises.appendFile('logs/out.log', `${nowISO()} | ${line}`)
}

export async function logErr(line: string) {
	console.error(`${nowISO()} | ${line}`)
	await fs.promises.appendFile('logs/err.log', `${nowISO()} | ${line}`)
}

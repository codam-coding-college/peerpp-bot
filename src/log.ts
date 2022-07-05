import fs from 'fs'

export function nowISO(d?: Date): string {
	if (!d)
		d = new Date()
	return `${d.toISOString().slice(0, -5)}Z`
}

fs.mkdirSync('logs', { recursive: true })

export async function log(line: string) {
	const now = nowISO()
	console.log(`${now} | ${line}`)
	await fs.promises.appendFile('logs/out.log', `${now} | ${line}${line.match(/\n$/) ? '' : '\n'}`)
}

export async function logErr(line: string) {
	const now = nowISO()
	console.error(`${now} | ${line}`)
	await fs.promises.appendFile('logs/err.log', `${now} | ${line}${line.match(/\n$/) ? '' : '\n'}`)
}

import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(
	readFileSync(resolve(import.meta.dir, '..', 'package.json'), 'utf-8'),
) as { version: string }

export const program = new Command()
	.name('autopilot')
	.description('QUESTPIE Autopilot — AI-native company operating system')
	.version(pkg.version, '-v, --version', 'Show CLI version')

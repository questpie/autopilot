/**
 * Messages are append-only — each message gets a unique file path based on its ID.
 * No write queue is needed because there is no read-modify-write cycle:
 * concurrent message sends create distinct files and never conflict.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { MessageSchema, PATHS } from '@questpie/autopilot-spec'
import { readYaml, writeYaml } from './yaml'

export type MessageOutput = z.output<typeof MessageSchema>

function generateMessageId(): string {
	return `msg-${Date.now().toString(36)}`
}

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath.replace(/^\/company/, ''))
}

function now(): string {
	return new Date().toISOString()
}

export async function sendChannelMessage(
	companyRoot: string,
	channel: string,
	message: {
		id?: string
		from: string
		at?: string
		content: string
		mentions?: string[]
		references?: string[]
		thread?: string | null
		transport?: string
		external?: boolean
	},
): Promise<MessageOutput> {
	const id = message.id ?? generateMessageId()
	const timestamp = message.at ?? now()

	const msg = MessageSchema.parse({
		...message,
		id,
		at: timestamp,
		channel,
	})

	const dirPath = resolvePath(companyRoot, `${PATHS.CHANNELS_DIR}/${channel}`)
	const filePath = join(dirPath, `${msg.id}.yaml`)
	await writeYaml(filePath, msg)
	return msg
}

export async function sendDirectMessage(
	companyRoot: string,
	from: string,
	to: string,
	message: {
		id?: string
		at?: string
		content: string
		mentions?: string[]
		references?: string[]
		thread?: string | null
		transport?: string
		external?: boolean
	},
): Promise<MessageOutput> {
	const id = message.id ?? generateMessageId()
	const timestamp = message.at ?? now()

	const parties = [from, to].sort()
	const dirName = parties.join('--')

	const msg = MessageSchema.parse({
		...message,
		id,
		at: timestamp,
		from,
		to,
	})

	const dirPath = resolvePath(companyRoot, `${PATHS.DIRECT_DIR}/${dirName}`)
	const filePath = join(dirPath, `${msg.id}.yaml`)
	await writeYaml(filePath, msg)
	return msg
}

export async function readChannelMessages(
	companyRoot: string,
	channel: string,
	limit?: number,
): Promise<MessageOutput[]> {
	const dirPath = resolvePath(companyRoot, `${PATHS.CHANNELS_DIR}/${channel}`)
	let files: string[]
	try {
		files = await readdir(dirPath)
	} catch {
		return []
	}

	const yamlFiles = files.filter((f) => f.endsWith('.yaml')).sort()
	const filesToRead = limit ? yamlFiles.slice(-limit) : yamlFiles
	const messages: MessageOutput[] = []

	for (const file of filesToRead) {
		try {
			const msg = await readYaml(join(dirPath, file), MessageSchema)
			messages.push(msg)
		} catch {
			// skip invalid
		}
	}

	return messages
}

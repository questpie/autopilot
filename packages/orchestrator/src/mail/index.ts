import { createTransport, type Transporter } from 'nodemailer'
import { logger } from '../logger'

export interface MailMessage {
	to: string
	subject: string
	html: string
}

export interface MailService {
	send(message: MailMessage): Promise<void>
	canSend(): boolean
}

function createSmtpMailService(host: string, port: number, user?: string, pass?: string, from?: string): MailService {
	const transporter: Transporter = createTransport({
		host,
		port,
		secure: port === 465,
		...(user && pass ? { auth: { user, pass } } : {}),
	})

	const sender = from || 'autopilot@localhost'

	return {
		canSend: () => true,
		send: async (message) => {
			await transporter.sendMail({
				from: sender,
				to: message.to,
				subject: message.subject,
				html: message.html,
			})
			logger.info('mail', `Sent "${message.subject}" to ${message.to}`)
		},
	}
}

function createConsoleMailService(): MailService {
	return {
		canSend: () => false,
		send: async (message) => {
			logger.info('mail', `[NO SMTP] To: ${message.to} | Subject: ${message.subject}`)
			// Extract href from HTML for quick copy-paste from console
			const hrefMatch = message.html.match(/href="([^"]+)"/)
			if (hrefMatch) {
				logger.info('mail', `[NO SMTP] Link: ${hrefMatch[1]}`)
			}
		},
	}
}

export function createMailService(): MailService {
	const host = process.env.SMTP_HOST
	const port = Number(process.env.SMTP_PORT)

	if (host && port) {
		logger.info('mail', `SMTP configured: ${host}:${port}`)
		return createSmtpMailService(
			host,
			port,
			process.env.SMTP_USER,
			process.env.SMTP_PASS,
			process.env.SMTP_FROM,
		)
	}

	logger.info('mail', 'No SMTP configured — emails will be printed to console')
	return createConsoleMailService()
}

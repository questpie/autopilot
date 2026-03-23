import { getRouter } from './src/router'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

const handler = createStartHandler({ getRouter })

export default {
	port: 3001,
	fetch: handler(defaultStreamHandler),
}

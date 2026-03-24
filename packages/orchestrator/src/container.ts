/**
 * DI container for the QUESTPIE Autopilot orchestrator.
 *
 * This file only exports the container instance and the companyRoot config.
 * All service factories are colocated with their modules — each module
 * registers itself by importing this container.
 */
import { Container } from '@drepkovsky/tinydi'

export const container = new Container()

/** Company root path — must be configured before resolving any service. */
const _companyRootFactory = container.register(
	'companyRoot',
	() => {
		throw new Error('companyRoot not configured — call configureContainer() first')
	},
)
export const companyRootFactory = container.reference<typeof _companyRootFactory>('companyRoot')

/** Set the company root path. Must be called once at startup. */
export function configureContainer(companyRoot: string) {
	container.register('companyRoot', () => companyRoot)
}

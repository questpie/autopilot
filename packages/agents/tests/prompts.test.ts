import { describe, expect, it } from 'bun:test'
import * as agents from '../src/index'

describe('agents package deprecation', () => {
	it('exports no legacy prompt builders', () => {
		expect(agents).toEqual({})
	})
})

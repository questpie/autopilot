#!/usr/bin/env bun
/**
 * Verify canary install works end-to-end.
 *
 * Usage:
 *   bun run release:canary:verify
 */
import { fmt, runStreamOrDie } from './lib'

fmt.info('Verify canary install')
console.log()

// ── Install ───────────────────────────────────────────────────
fmt.info('Installing @questpie/autopilot@canary...')
await runStreamOrDie(['bun', 'add', '-g', '@questpie/autopilot@canary'], 'canary install')
console.log()

// ── Version ───────────────────────────────────────────────────
fmt.info('CLI version:')
await runStreamOrDie(['autopilot', '-v'], 'autopilot -v')
console.log()

fmt.info('Package versions:')
await runStreamOrDie(['autopilot', 'version', '--offline'], 'autopilot version')
console.log()

// ── Doctor ────────────────────────────────────────────────────
fmt.info('Doctor (offline):')
await runStreamOrDie(['autopilot', 'doctor', '--offline', '--runtimes', ''], 'autopilot doctor')
console.log()

fmt.ok('Canary install verified')

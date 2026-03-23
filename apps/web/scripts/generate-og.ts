/**
 * Generate OG images (1200x630) as SVG → PNG using resvg-js
 *
 * Usage: bun run apps/web/scripts/generate-og.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const OUT_DIR = join(import.meta.dir, '..', 'public')
mkdirSync(OUT_DIR, { recursive: true })

const W = 1200
const H = 630

// The QuestPie symbol: L-path + purple rect
const SYMBOL = `
  <g transform="translate(506, 160) scale(4)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="square">
    <path d="M10 2H2v20h8" />
    <path d="M14 2h8v8" />
    <rect x="13" y="13" width="10" height="10" fill="#B700FF" stroke="none" />
  </g>
`

const SYMBOL_SMALL = `
  <g transform="translate(40, 28) scale(1.5)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="square">
    <path d="M10 2H2v20h8" />
    <path d="M14 2h8v8" />
    <rect x="13" y="13" width="10" height="10" fill="#B700FF" stroke="none" />
  </g>
`

interface OgConfig {
	filename: string
	title: string
	subtitle?: string
}

function generateOgSvg(config: OgConfig): string {
	const titleY = config.subtitle ? 400 : 420
	const subtitleBlock = config.subtitle
		? `<text x="600" y="${titleY + 50}" text-anchor="middle" fill="#999999" font-family="Inter, sans-serif" font-size="28" font-weight="400">${escapeXml(config.subtitle)}</text>`
		: ''

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&amp;display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#0A0A0A"/>

  <!-- Subtle grid -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.5"/>

  <!-- Purple accent line top -->
  <rect x="0" y="0" width="${W}" height="4" fill="#B700FF"/>

  <!-- Symbol -->
  ${SYMBOL}

  <!-- Title -->
  <text x="600" y="${titleY}" text-anchor="middle" fill="#ffffff" font-family="Inter, sans-serif" font-size="42" font-weight="900" letter-spacing="-0.02em">${escapeXml(config.title)}</text>

  ${subtitleBlock}

  <!-- Bottom bar -->
  <rect x="0" y="${H - 60}" width="${W}" height="60" fill="#111111"/>
  ${SYMBOL_SMALL.replace('translate(40, 28)', `translate(40, ${H - 60 + 12})`)}
  <text x="90" y="${H - 24}" fill="#999999" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700">QUESTPIE</text>
  <text x="${W - 40}" y="${H - 24}" text-anchor="end" fill="#666666" font-family="JetBrains Mono, monospace" font-size="14">autopilot.questpie.com</text>
</svg>`
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

// ── Define all OG images ──────────────────────────────────────

const pages: OgConfig[] = [
	{
		filename: 'og-default',
		title: 'QUESTPIE Autopilot',
		subtitle: 'AI-Native Company Operating System',
	},
	{
		filename: 'og-docs',
		title: 'Documentation',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-getting-started',
		title: 'Getting Started',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-architecture',
		title: 'Architecture',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-agents',
		title: 'AI Agents',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-skills',
		title: 'Skills',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-artifacts',
		title: 'Artifacts',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-living-dashboard',
		title: 'Living Dashboard',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-integrations',
		title: 'Integrations',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-use-cases',
		title: 'Use Cases',
		subtitle: 'QUESTPIE Autopilot',
	},
	{
		filename: 'og-cli',
		title: 'CLI Reference',
		subtitle: 'QUESTPIE Autopilot',
	},
]

// ── Load fonts for resvg ──────────────────────────────────────

const FONT_DIR = join(import.meta.dir, '..', 'fonts')

function loadFont(name: string): Buffer | null {
	try {
		return readFileSync(join(FONT_DIR, name)) as unknown as Buffer
	} catch {
		return null
	}
}

// ── Generate ──────────────────────────────────────────────────

// Build font list from local fonts directory (if available)
const fontFiles = ['Inter-Black.ttf', 'Inter-Regular.ttf', 'JetBrainsMono-Bold.ttf']
const fontBuffers: Buffer[] = []
for (const f of fontFiles) {
	const buf = loadFont(f)
	if (buf) fontBuffers.push(buf)
}

for (const page of pages) {
	const svg = generateOgSvg(page)

	// Save SVG
	const svgPath = join(OUT_DIR, `${page.filename}.svg`)
	writeFileSync(svgPath, svg)

	// Convert to PNG
	try {
		const resvg = new Resvg(svg, {
			fitTo: { mode: 'width', value: W },
			font: {
				fontBuffers,
				loadSystemFonts: true,
			},
		})
		const pngData = resvg.render()
		const pngBuffer = pngData.asPng()
		const pngPath = join(OUT_DIR, `${page.filename}.png`)
		writeFileSync(pngPath, pngBuffer)
		console.log(`  ${page.filename}.png (${Math.round(pngBuffer.length / 1024)}KB)`)
	} catch (err) {
		console.log(`  ${page.filename}.svg (PNG failed: ${err})`)
	}
}

console.log(`\nGenerated ${pages.length} OG images in ${OUT_DIR}`)

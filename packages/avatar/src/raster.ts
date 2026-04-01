/**
 * Pixel raster renderer for construct avatars.
 *
 * Renders to a Uint8Array RGBA pixel buffer, then encodes to PNG.
 * Produces crisp 8-bit pixel art at any display size via nearest-neighbor
 * scaling (`image-rendering: pixelated`).
 *
 * Resolution tiers (automatic LOD):
 * - 16×16: head + eyes + LED + brand accent
 * - 32×32: + jaw, top/side decor, frame
 * - 64×64: + patterns, bg grid, full detail
 */
import { resolveContext, CELL, BRAND } from './core'

// ── Types ───────────────────────────────────────────────────────────────

export interface RasterOptions {
	seed: string
	/** Raster resolution. Always 64 for full detail — browser scales down with pixelated. */
	resolution?: 64
	theme?: 'dark' | 'light'
	style?: 'solid' | 'wireframe'
}

export interface RasterResult {
	pixels: Uint8Array
	size: number
}

type RGBA = [number, number, number, number]

// ── Color utils ─────────────────────────────────────────────────────────

function parseHex(hex: string): RGBA {
	const h = hex.startsWith('#') ? hex.slice(1) : hex
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16),
		255,
	]
}

// ── Pixel buffer ops ────────────────────────────────────────────────────

function createBuffer(size: number): Uint8Array {
	return new Uint8Array(size * size * 4)
}

function setPixel(buf: Uint8Array, size: number, x: number, y: number, rgba: RGBA): void {
	if (x < 0 || x >= size || y < 0 || y >= size) return
	const i = (y * size + x) * 4
	buf[i] = rgba[0]
	buf[i + 1] = rgba[1]
	buf[i + 2] = rgba[2]
	buf[i + 3] = rgba[3]
}

/** Fill a rectangle in grid coordinates (16×16 grid mapped to resolution). */
function fillRect(
	buf: Uint8Array,
	size: number,
	scale: number,
	gx: number,
	gy: number,
	gw: number,
	gh: number,
	rgba: RGBA,
): void {
	const x0 = Math.round(gx * scale)
	const y0 = Math.round(gy * scale)
	const x1 = Math.round((gx + gw) * scale)
	const y1 = Math.round((gy + gh) * scale)
	for (let py = y0; py < y1; py++) {
		for (let px = x0; px < x1; px++) {
			setPixel(buf, size, px, py, rgba)
		}
	}
}

/** Stroke a rectangle outline in grid coordinates. */
function strokeRect(
	buf: Uint8Array,
	size: number,
	scale: number,
	gx: number,
	gy: number,
	gw: number,
	gh: number,
	rgba: RGBA,
	strokeW: number,
): void {
	// Top
	fillRect(buf, size, scale, gx, gy, gw, strokeW / CELL, rgba)
	// Bottom
	fillRect(buf, size, scale, gx, gy + gh - strokeW / CELL, gw, strokeW / CELL, rgba)
	// Left
	fillRect(buf, size, scale, gx, gy, strokeW / CELL, gh, rgba)
	// Right
	fillRect(buf, size, scale, gx + gw - strokeW / CELL, gy, strokeW / CELL, gh, rgba)
}

// ── Renderer ────────────────────────────────────────────────────────────

export function renderPixels(options: RasterOptions): RasterResult {
	const resolution = 64 // always full detail — browser scales with pixelated
	const scale = resolution / 16 // 16×16 grid → 4px per cell
	const ctx = resolveContext({
		seed: options.seed,
		size: 200, // always trigger full LOD in core
		style: options.style,
		theme: options.theme,
	})

	const { dna, head: h, style } = ctx

	const bgColor = parseHex(ctx.bg)
	const fgColor = parseHex(ctx.fg)
	const surfaceColor = parseHex(ctx.surface)
	const midColor = parseHex(ctx.mid)
	const ledColor = parseHex(ctx.ledColor)
	const brandColor = parseHex(BRAND)
	const eyeColor = parseHex(ctx.eyeColor)
	const fillColor = style === 'wireframe' ? bgColor : surfaceColor

	const buf = createBuffer(resolution)

	// 1. Background fill
	fillRect(buf, resolution, scale, 0, 0, 16, 16, bgColor)

	// 2. Background grid pattern (solid only)
	if (style === 'solid' && dna.bg === 3) {
		for (let gy = 0; gy < 16; gy += 2) {
			for (let gx = 0; gx < 16; gx += 2) {
				setPixel(buf, resolution, Math.round(gx * scale), Math.round(gy * scale), midColor)
			}
		}
	}

	// 3. Top decor
	{
		if (dna.top === 0) {
			// Antenna
			fillRect(buf, resolution, scale, h.x + Math.floor(h.w / 2), h.y - 2, 1, 2, fgColor)
			fillRect(buf, resolution, scale, h.x + Math.floor(h.w / 2) - 1, h.y - 3, 3, 1, fgColor)
		} else if (dna.top === 1) {
			// Dual horns
			fillRect(buf, resolution, scale, h.x + 1, h.y - 1, 2, 1, fgColor)
			fillRect(buf, resolution, scale, h.x + h.w - 4, h.y - 1, 2, 1, fgColor)
		} else if (dna.top === 2) {
			// Wide hat
			fillRect(buf, resolution, scale, h.x + 2, h.y - 1, h.w - 4, 1, fgColor)
		} else if (dna.top === 3) {
			// Single spike
			fillRect(buf, resolution, scale, h.x + 1, h.y - 2, 1, 2, fgColor)
		} else if (dna.top === 4) {
			// Flat cap
			fillRect(buf, resolution, scale, h.x + 3, h.y - 1, h.w - 6, 1, fgColor)
		} else if (dna.top === 5) {
			// Corner box
			fillRect(buf, resolution, scale, h.x + h.w - 3, h.y - 2, 2, 2, fgColor)
		} else if (dna.top === 6) {
			// Visor
			strokeRect(buf, resolution, scale, h.x + 1, h.y - 2, h.w - 2, 2, fgColor, 4)
		}
	}

	// 4. Side decor
	{
		if (dna.side === 0) {
			strokeRect(buf, resolution, scale, h.x - 2, h.y + 2, 2, 3, fgColor, 4)
		} else if (dna.side === 1) {
			fillRect(buf, resolution, scale, h.x - 1, h.y + 1, 1, 4, fgColor)
		} else if (dna.side === 2) {
			fillRect(buf, resolution, scale, h.x - 2, h.y + 3, 1, 1, fgColor)
			fillRect(buf, resolution, scale, h.x - 2, h.y + 5, 1, 1, fgColor)
		} else if (dna.side === 3) {
			fillRect(buf, resolution, scale, h.x - 2, h.y + 4, 2, 2, fgColor)
		} else if (dna.side === 4) {
			strokeRect(buf, resolution, scale, h.x - 2, h.y + 2, 2, 4, fgColor, 4)
		} else if (dna.side === 5) {
			fillRect(buf, resolution, scale, h.x - 1, h.y + 2, 1, 1, fgColor)
			fillRect(buf, resolution, scale, h.x + h.w, h.y + 2, 1, 1, fgColor)
		} else if (dna.side === 6) {
			fillRect(buf, resolution, scale, h.x - 2, h.y + 2, 2, 1, fgColor)
		}
	}

	// 5. Head base
	if (style === 'wireframe') {
		strokeRect(buf, resolution, scale, h.x, h.y, h.w, h.h, fgColor, 4)
	} else {
		fillRect(buf, resolution, scale, h.x, h.y, h.w, h.h, fillColor)
		// Outline
		strokeRect(buf, resolution, scale, h.x, h.y, h.w, h.h, fgColor, 4)
	}

	// 6. Internal pattern (solid only)
	if (style === 'solid') {
		if (dna.pattern === 1) {
			// Horizontal stripes
			fillRect(buf, resolution, scale, h.x + 1, h.y + 1, h.w - 3, 1, midColor)
			fillRect(buf, resolution, scale, h.x + 1, h.y + 3, h.w - 3, 1, midColor)
		} else if (dna.pattern === 2) {
			// Vertical stripe
			fillRect(buf, resolution, scale, h.x + 1, h.y + 1, 2, h.h - 2, midColor)
		}
	}

	// 7. Eyes
	const jY = h.y + h.h
	if (dna.eye === 0) {
		// Visor bar
		fillRect(buf, resolution, scale, h.x + 1, h.y + 2, h.w - 2, 1, eyeColor)
	} else if (dna.eye === 1) {
		// Two dots
		fillRect(buf, resolution, scale, h.x + 1, h.y + 2, 1, 1, eyeColor)
		fillRect(buf, resolution, scale, h.x + h.w - 2, h.y + 2, 1, 1, eyeColor)
	} else if (dna.eye === 2) {
		// Asymmetric
		fillRect(buf, resolution, scale, h.x + 1, h.y + 2, 2, 1, eyeColor)
		fillRect(buf, resolution, scale, h.x + h.w - 2, h.y + 2, 1, 1, eyeColor)
	} else if (dna.eye === 3) {
		// Center cyclops
		const cx = h.x + Math.floor(h.w / 2) - 1
		strokeRect(buf, resolution, scale, cx, h.y + 2, 2, 2, eyeColor, 4)
		fillRect(buf, resolution, scale, cx + 0.5, h.y + 2.5, 1, 1, eyeColor)
	} else if (dna.eye === 4) {
		// Three dots
		fillRect(buf, resolution, scale, h.x + 1, h.y + 2, 1, 1, eyeColor)
		fillRect(buf, resolution, scale, h.x + 3, h.y + 2, 1, 1, eyeColor)
		if (h.w > 6) fillRect(buf, resolution, scale, h.x + 5, h.y + 2, 1, 1, eyeColor)
	} else if (dna.eye === 5) {
		// Vertical slit
		const cx = h.x + Math.floor(h.w / 2)
		fillRect(buf, resolution, scale, cx, h.y + 1, 1, 3, eyeColor)
	} else if (dna.eye === 6) {
		// Diagonal
		fillRect(buf, resolution, scale, h.x + 1, h.y + 2, 1, 1, eyeColor)
		fillRect(buf, resolution, scale, h.x + 2, h.y + 3, 1, 1, eyeColor)
	} else if (dna.eye === 7) {
		// Wide visor
		fillRect(buf, resolution, scale, h.x + 1, h.y + 2, h.w - 2, 1, eyeColor)
		fillRect(buf, resolution, scale, h.x + 2, h.y + 2, 2, 1, fgColor)
	}

	// 8. Jaw
	{
		if (dna.jaw === 0) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 2, 2, 1, eyeColor)
		} else if (dna.jaw === 1) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 2, 1, 1, eyeColor)
			fillRect(buf, resolution, scale, h.x + 2, jY - 2, 1, 1, eyeColor)
		} else if (dna.jaw === 2) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 2, 3, 1, eyeColor)
		} else if (dna.jaw === 3) {
			strokeRect(buf, resolution, scale, h.x + 1, jY - 2, 2, 1, eyeColor, 4)
		} else if (dna.jaw === 4) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 2, 1, 1, eyeColor)
			fillRect(buf, resolution, scale, h.x + 2, jY - 2, 1, 1, eyeColor)
		} else if (dna.jaw === 5) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 3, 2, 2, eyeColor)
		} else if (dna.jaw === 6) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 3, 1, 2, eyeColor)
		} else if (dna.jaw === 7) {
			fillRect(buf, resolution, scale, h.x + 1, jY - 2, 2, 1, eyeColor)
		}
	}

	// 9. LED indicator (always)
	fillRect(buf, resolution, scale, h.x + 0.5, h.y + 0.5, 0.5, 0.5, ledColor)

	// 10. Brand accent — purple corner
	fillRect(buf, resolution, scale, h.x + h.w - 2, h.y + h.h - 2, 2, 2, brandColor)

	// 11. Frame border (always)
	fillRect(buf, resolution, scale, 0, 0, 16, 0.5, midColor)
	fillRect(buf, resolution, scale, 0, 15.5, 16, 0.5, midColor)
	fillRect(buf, resolution, scale, 0, 0, 0.5, 16, midColor)
	fillRect(buf, resolution, scale, 15.5, 0, 0.5, 16, midColor)

	return { pixels: buf, size: resolution }
}

// ── Minimal zlib (stored, no compression) ───────────────────────────────

/** Adler-32 checksum for zlib footer. */
function adler32(data: Uint8Array): number {
	let a = 1
	let b = 0
	for (let i = 0; i < data.length; i++) {
		a = (a + data[i]!) % 65521
		b = (b + a) % 65521
	}
	return ((b << 16) | a) >>> 0
}

/**
 * Wrap raw data in zlib format with stored (uncompressed) deflate blocks.
 * Max block size is 65535 bytes — splits into multiple blocks if needed.
 */
function zlibStored(data: Uint8Array): Uint8Array {
	const maxBlock = 65535
	const numBlocks = Math.ceil(data.length / maxBlock) || 1
	// 2 byte zlib header + (5 byte block header + block data) per block + 4 byte adler32
	const outLen = 2 + numBlocks * 5 + data.length + 4
	const out = new Uint8Array(outLen)
	const view = new DataView(out.buffer)

	// Zlib header: CMF=0x78 (deflate, window=32K), FLG=0x01 (no dict, check bits)
	out[0] = 0x78
	out[1] = 0x01

	let pos = 2
	let remaining = data.length
	let offset = 0

	while (remaining > 0 || offset === 0) {
		const blockLen = Math.min(remaining, maxBlock)
		const isLast = remaining <= maxBlock
		out[pos++] = isLast ? 1 : 0 // BFINAL + BTYPE=00 (stored)
		out[pos++] = blockLen & 0xff
		out[pos++] = (blockLen >> 8) & 0xff
		out[pos++] = ~blockLen & 0xff
		out[pos++] = (~blockLen >> 8) & 0xff
		out.set(data.subarray(offset, offset + blockLen), pos)
		pos += blockLen
		offset += blockLen
		remaining -= blockLen
	}

	// Adler-32 checksum (big-endian)
	view.setUint32(pos, adler32(data))

	return out.subarray(0, pos + 4)
}

// ── Minimal PNG encoder ─────────────────────────────────────────────────

function crc32(buf: Uint8Array): number {
	let c = 0xffffffff
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i]!
		for (let j = 0; j < 8; j++) {
			c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
		}
	}
	return c ^ 0xffffffff
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const len = data.length
	const buf = new Uint8Array(12 + len)
	const view = new DataView(buf.buffer)
	view.setUint32(0, len)
	buf[4] = type.charCodeAt(0)
	buf[5] = type.charCodeAt(1)
	buf[6] = type.charCodeAt(2)
	buf[7] = type.charCodeAt(3)
	buf.set(data, 8)
	const crcData = buf.slice(4, 8 + len)
	view.setUint32(8 + len, crc32(crcData) >>> 0)
	return buf
}

export function renderPng(options: RasterOptions): Uint8Array {
	const { pixels, size } = renderPixels(options)

	// IHDR
	const ihdr = new Uint8Array(13)
	const ihdrView = new DataView(ihdr.buffer)
	ihdrView.setUint32(0, size) // width
	ihdrView.setUint32(4, size) // height
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // color type: RGBA
	ihdr[10] = 0 // compression
	ihdr[11] = 0 // filter
	ihdr[12] = 0 // interlace

	// Raw image data: filter byte (0) + row pixels
	const rawLen = size * (1 + size * 4)
	const raw = new Uint8Array(rawLen)
	for (let y = 0; y < size; y++) {
		const rowOffset = y * (1 + size * 4)
		raw[rowOffset] = 0 // no filter
		raw.set(pixels.subarray(y * size * 4, (y + 1) * size * 4), rowOffset + 1)
	}

	// Wrap in zlib stored (no compression) — works in browser, no deps
	const compressed = zlibStored(raw)

	// Assemble PNG
	const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
	const ihdrChunk = chunk('IHDR', ihdr)
	const idatChunk = chunk('IDAT', compressed)
	const iendChunk = chunk('IEND', new Uint8Array(0))

	const png = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length)
	let offset = 0
	png.set(signature, offset); offset += signature.length
	png.set(ihdrChunk, offset); offset += ihdrChunk.length
	png.set(idatChunk, offset); offset += idatChunk.length
	png.set(iendChunk, offset)

	return png
}

export function renderDataUrl(options: RasterOptions): string {
	const png = renderPng(options)
	// Browser-safe base64 encoding (no Buffer dependency)
	let binary = ''
	for (let i = 0; i < png.length; i++) {
		binary += String.fromCharCode(png[i]!)
	}
	const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(png).toString('base64')
	return `data:image/png;base64,${b64}`
}

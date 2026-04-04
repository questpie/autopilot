import {
	Children,
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react'

import { cn } from '@/lib/utils'

/* ─── Types ─── */

type Rect = { x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }
type NodeEntry = { col: number; row: number; colSpan: number; rect: Rect }
type NodeMap = Map<string, NodeEntry>

type EdgeDef = {
	from: string
	to: string
	label?: string
	fromSide?: Side
	toSide?: Side
	dashed?: boolean
}

type Side = 'top' | 'bottom' | 'left' | 'right'

type ChannelMap = {
	hChannels: number[] // Y-coordinates of horizontal routing channels
	vChannels: number[] // X-coordinates of vertical routing channels
	rowBounds: { top: number; bottom: number }[]
	colBounds: { left: number; right: number }[]
}

/* ─── FlowNode ─── */

type FlowNodeVariant = 'default' | 'agent' | 'human' | 'done' | 'artifact'

const variantStyles: Record<FlowNodeVariant, string> = {
	default: 'border-border bg-background',
	agent: 'border-border bg-background',
	human:
		'border-[color-mix(in_oklab,var(--border)_60%,var(--primary)_40%)] bg-[color-mix(in_oklab,var(--background)_96%,var(--primary)_4%)]',
	done: 'border-[color-mix(in_oklab,var(--border)_60%,var(--success)_40%)] bg-[color-mix(in_oklab,var(--background)_96%,var(--success)_4%)]',
	artifact: 'border-border bg-card',
}

type FlowNodeSize = 'sm' | 'md' | 'lg'

const sizeStyles: Record<FlowNodeSize, string> = {
	sm: 'px-2.5 py-1.5',
	md: 'px-3 py-2.5',
	lg: 'px-4 py-3.5',
}

const sizeFonts: Record<FlowNodeSize, { label: string; meta: string; desc: string }> = {
	sm: { label: 'text-[11px]', meta: 'text-[7px]', desc: 'text-[9px]' },
	md: { label: 'text-[13px]', meta: 'text-[9px]', desc: 'text-[11px]' },
	lg: { label: 'text-[15px]', meta: 'text-[10px]', desc: 'text-[12px]' },
}

export function FlowNode({
	id,
	label,
	meta,
	desc,
	variant = 'default',
	size = 'md',
	col,
	row,
	colSpan,
	fit,
	className,
}: {
	id: string
	label: string
	meta?: string
	desc?: string
	variant?: FlowNodeVariant
	size?: FlowNodeSize
	col: number
	row: number
	colSpan?: number
	/** Shrink node to content width and center in grid cell */
	fit?: boolean
	className?: string
}) {
	const fonts = sizeFonts[size]
	return (
		<div
			data-flow-node={id}
			data-flow-col={col}
			data-flow-row={row}
			data-flow-colspan={colSpan ?? 1}
			className={cn('border', sizeStyles[size], variantStyles[variant], fit && 'w-fit justify-self-center', className)}
			style={{
				gridColumn: `${col} / span ${colSpan ?? 1}`,
				gridRow: `${row}`,
			}}
		>
			{meta && (
				<div className={cn('text-muted-foreground mb-0.5 font-mono tracking-[0.18em] uppercase', fonts.meta)}>
					{meta}
				</div>
			)}
			<div className={cn('font-mono font-bold leading-tight', fonts.label)}>{label}</div>
			{desc && (
				<div className={cn('text-muted-foreground mt-0.5 leading-snug', fonts.desc)}>{desc}</div>
			)}
		</div>
	)
}

/* ─── FlowEdge (declarative) ─── */

export function FlowEdge(_props: {
	from: string
	to: string
	label?: string
	fromSide?: Side
	toSide?: Side
	dashed?: boolean
}) {
	return null
}

/* ─── FlowAnimation (declarative — defines traversal path) ─── */

export function FlowAnimation(_props: {
	/** Ordered list of node IDs defining the traversal path */
	path: string[]
	/** Duration per edge segment in seconds */
	speed?: number
	/** Dot color — defaults to primary */
	color?: string
	/** Dot radius */
	radius?: number
	/** Loop the animation */
	loop?: boolean
}) {
	return null
}

/* ─── Geometry helpers ─── */

function anchor(rect: Rect, side: Side): Pt {
	switch (side) {
		case 'top':
			return { x: rect.x + rect.w / 2, y: rect.y }
		case 'bottom':
			return { x: rect.x + rect.w / 2, y: rect.y + rect.h }
		case 'left':
			return { x: rect.x, y: rect.y + rect.h / 2 }
		case 'right':
			return { x: rect.x + rect.w, y: rect.y + rect.h / 2 }
	}
}

/* ─── Channel-based routing ─── */

function buildChannelMap(nodeMap: NodeMap, gap: number): ChannelMap {
	// Group nodes by grid row and col
	const rowNodes = new Map<number, NodeEntry[]>()
	const colNodes = new Map<number, NodeEntry[]>()

	for (const entry of nodeMap.values()) {
		const rList = rowNodes.get(entry.row) ?? []
		rList.push(entry)
		rowNodes.set(entry.row, rList)

		for (let c = entry.col; c < entry.col + entry.colSpan; c++) {
			const cList = colNodes.get(c) ?? []
			cList.push(entry)
			colNodes.set(c, cList)
		}
	}

	// Compute row bounds (sorted by row number)
	const sortedRows = [...rowNodes.keys()].sort((a, b) => a - b)
	const rowBounds = sortedRows.map((r) => {
		const nodes = rowNodes.get(r)!
		return {
			top: Math.min(...nodes.map((n) => n.rect.y)),
			bottom: Math.max(...nodes.map((n) => n.rect.y + n.rect.h)),
		}
	})

	// Compute col bounds (sorted by col number)
	const sortedCols = [...colNodes.keys()].sort((a, b) => a - b)
	const colBounds = sortedCols.map((c) => {
		const nodes = colNodes.get(c)!
		return {
			left: Math.min(...nodes.map((n) => n.rect.x)),
			right: Math.max(...nodes.map((n) => n.rect.x + n.rect.w)),
		}
	})

	// Horizontal channels: midpoints between consecutive row bounds + margins
	const hChannels: number[] = []
	if (rowBounds.length > 0) {
		hChannels.push(rowBounds[0].top - gap * 2) // top margin
		for (let i = 0; i < rowBounds.length - 1; i++) {
			hChannels.push((rowBounds[i].bottom + rowBounds[i + 1].top) / 2)
		}
		hChannels.push(rowBounds[rowBounds.length - 1].bottom + gap * 2) // bottom margin
	}

	// Vertical channels: midpoints between consecutive col bounds + margins
	const vChannels: number[] = []
	if (colBounds.length > 0) {
		vChannels.push(colBounds[0].left - gap * 2) // left margin
		for (let i = 0; i < colBounds.length - 1; i++) {
			vChannels.push((colBounds[i].right + colBounds[i + 1].left) / 2)
		}
		vChannels.push(colBounds[colBounds.length - 1].right + gap * 2) // right margin
	}

	return { hChannels, vChannels, rowBounds, colBounds }
}

function inferSidesFromGrid(
	fromEntry: NodeEntry,
	toEntry: NodeEntry,
	fs?: Side,
	ts?: Side,
): { fs: Side; ts: Side } {
	if (fs && ts) return { fs, ts }

	const sameRow = fromEntry.row === toEntry.row
	const sameCol = fromEntry.col === toEntry.col

	if (sameRow) {
		// Horizontal neighbors
		if (toEntry.col > fromEntry.col) {
			return { fs: fs ?? 'right', ts: ts ?? 'left' }
		}
		return { fs: fs ?? 'left', ts: ts ?? 'right' }
	}

	if (sameCol) {
		// Vertical neighbors
		if (toEntry.row > fromEntry.row) {
			return { fs: fs ?? 'bottom', ts: ts ?? 'top' }
		}
		return { fs: fs ?? 'top', ts: ts ?? 'bottom' }
	}

	// Diagonal — prefer vertical exit/entry based on row direction
	if (toEntry.row > fromEntry.row) {
		return { fs: fs ?? 'bottom', ts: ts ?? 'top' }
	}
	return { fs: fs ?? 'top', ts: ts ?? 'bottom' }
}

/** Find the nearest channel value to a target in a sorted channel array */
function nearestChannel(channels: number[], target: number): number {
	let best = channels[0]
	let bestDist = Math.abs(target - best)
	for (let i = 1; i < channels.length; i++) {
		const dist = Math.abs(target - channels[i])
		if (dist < bestDist) {
			best = channels[i]
			bestDist = dist
		}
	}
	return best
}

/** Find the nearest channel in a specific direction from a point */
function nearestChannelInDirection(
	channels: number[],
	from: number,
	direction: 'positive' | 'negative',
): number {
	const candidates =
		direction === 'positive' ? channels.filter((c) => c >= from) : channels.filter((c) => c <= from)
	if (candidates.length === 0) {
		// Fallback: just use the nearest channel overall
		return nearestChannel(channels, from)
	}
	return direction === 'positive'
		? Math.min(...candidates)
		: Math.max(...candidates)
}

function routeEdgeThroughChannels(
	start: Pt,
	end: Pt,
	fs: Side,
	ts: Side,
	fromEntry: NodeEntry,
	toEntry: NodeEntry,
	channelMap: ChannelMap,
): Pt[] {
	const { hChannels, vChannels } = channelMap

	const sameRow = fromEntry.row === toEntry.row
	const sameCol = fromEntry.col === toEntry.col
	const adjacentRow = Math.abs(fromEntry.row - toEntry.row) === 1
	const adjacentCol = Math.abs(fromEntry.col - toEntry.col) === 1

	// Same row, adjacent columns: straight horizontal
	if (sameRow && adjacentCol && isHoriz(fs) && isHoriz(ts)) {
		return [start, end]
	}

	// Same col, adjacent rows: straight vertical
	if (sameCol && adjacentRow && isVert(fs) && isVert(ts)) {
		return [start, end]
	}

	// Both exit/enter vertically (common: diagonal edges, same-col distant edges)
	if (isVert(fs) && isVert(ts)) {
		// Find the hChannel between the two rows
		const exitDir = fs === 'bottom' ? 'positive' : 'negative'
		const hCh = nearestChannelInDirection(hChannels, start.y, exitDir)

		if (Math.abs(start.x - end.x) < 1) {
			// Same X: just go through the channel vertically
			return [start, { x: start.x, y: hCh }, { x: end.x, y: hCh }, end]
		}

		// Diagonal: vertical out, horizontal along channel, vertical in
		return [start, { x: start.x, y: hCh }, { x: end.x, y: hCh }, end]
	}

	// Both exit/enter horizontally
	if (isHoriz(fs) && isHoriz(ts)) {
		const exitDir = fs === 'right' ? 'positive' : 'negative'
		const vCh = nearestChannelInDirection(vChannels, start.x, exitDir)

		if (Math.abs(start.y - end.y) < 1) {
			return [start, { x: vCh, y: start.y }, { x: vCh, y: end.y }, end]
		}

		return [start, { x: vCh, y: start.y }, { x: vCh, y: end.y }, end]
	}

	// Mixed: vertical exit, horizontal entry (or vice versa)
	// This handles loop-back edges and unusual routing

	if (isVert(fs) && isHoriz(ts)) {
		// Exit vertically, enter horizontally
		// Route: vertical to hChannel, horizontal to vChannel near target, then horizontal to target
		const exitDir = fs === 'bottom' ? 'positive' : 'negative'
		const hCh = nearestChannelInDirection(hChannels, start.y, exitDir)

		// We need to get to the target's horizontal entry side
		// Find a vChannel that aligns us to approach from the correct side
		const entryDir = ts === 'left' ? 'negative' : 'positive'
		const vCh = nearestChannelInDirection(vChannels, end.x, entryDir)

		return [
			start,
			{ x: start.x, y: hCh },
			{ x: vCh, y: hCh },
			{ x: vCh, y: end.y },
			end,
		]
	}

	// Horizontal exit, vertical entry
	const exitDir = fs === 'right' ? 'positive' : 'negative'
	const vCh = nearestChannelInDirection(vChannels, start.x, exitDir)
	const entryDir = ts === 'top' ? 'negative' : 'positive'
	const hCh = nearestChannelInDirection(hChannels, end.y, entryDir)

	return [
		start,
		{ x: vCh, y: start.y },
		{ x: vCh, y: hCh },
		{ x: end.x, y: hCh },
		end,
	]
}

function isVert(s: Side) {
	return s === 'top' || s === 'bottom'
}

function isHoriz(s: Side) {
	return s === 'left' || s === 'right'
}

/* ─── SVG path from points with rounded corners ─── */

function pointsToPath(pts: Pt[], radius: number): string {
	if (pts.length < 2) return ''
	if (pts.length === 2) return `M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y}`

	let d = `M${pts[0].x} ${pts[0].y}`

	for (let i = 1; i < pts.length - 1; i++) {
		const prev = pts[i - 1]
		const curr = pts[i]
		const next = pts[i + 1]

		const dx1 = curr.x - prev.x
		const dy1 = curr.y - prev.y
		const dx2 = next.x - curr.x
		const dy2 = next.y - curr.y

		const len1 = Math.hypot(dx1, dy1)
		const len2 = Math.hypot(dx2, dy2)

		const r = Math.min(radius, len1 / 2, len2 / 2)

		if (r < 1 || len1 < 1 || len2 < 1) {
			d += ` L${curr.x} ${curr.y}`
			continue
		}

		const sx = curr.x - (dx1 / len1) * r
		const sy = curr.y - (dy1 / len1) * r
		const ex = curr.x + (dx2 / len2) * r
		const ey = curr.y + (dy2 / len2) * r

		d += ` L${sx} ${sy} Q${curr.x} ${curr.y} ${ex} ${ey}`
	}

	const last = pts[pts.length - 1]
	d += ` L${last.x} ${last.y}`
	return d
}

/* ─── Path midpoint for label positioning ─── */

function pathMidpoint(pts: Pt[]): { pt: Pt; angle: number } {
	if (pts.length < 2) return { pt: pts[0] ?? { x: 0, y: 0 }, angle: 0 }

	// Compute total path length
	let totalLen = 0
	const segLens: number[] = []
	for (let i = 0; i < pts.length - 1; i++) {
		const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
		segLens.push(len)
		totalLen += len
	}

	// Walk to 50%
	let target = totalLen / 2
	for (let i = 0; i < segLens.length; i++) {
		if (target <= segLens[i] || i === segLens.length - 1) {
			const t = segLens[i] > 0 ? target / segLens[i] : 0
			const pt = {
				x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
				y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
			}
			const angle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x)
			return { pt, angle }
		}
		target -= segLens[i]
	}

	return { pt: pts[0], angle: 0 }
}

/* ─── Animation definition ─── */

type AnimationDef = {
	path: string[]
	speed: number
	color?: string
	radius: number
	loop: boolean
}

/* ─── Build traversal segments for JS-driven animation ─── */

type TraversalSegment = {
	/** SVG path d-string for this edge */
	d: string
	/** Node ID the dot leaves from */
	sourceNode: string
	/** Node ID the dot arrives at */
	targetNode: string
	/** Approximate length (for timing) */
	length: number
}

function buildTraversalSegments(
	animPath: string[],
	edges: EdgeDef[],
	nodeMap: NodeMap,
	channelMap: ChannelMap,
): TraversalSegment[] {
	const segments: TraversalSegment[] = []

	for (let i = 0; i < animPath.length - 1; i++) {
		const from = animPath[i]
		const to = animPath[i + 1]

		const fromEntry = nodeMap.get(from)
		const toEntry = nodeMap.get(to)
		if (!fromEntry || !toEntry) continue

		const edgeDef = edges.find((e) => e.from === from && e.to === to)

		const { fs, ts } = inferSidesFromGrid(
			fromEntry,
			toEntry,
			edgeDef?.fromSide,
			edgeDef?.toSide,
		)

		const start = anchor(fromEntry.rect, fs)
		const end = anchor(toEntry.rect, ts)
		const pts = routeEdgeThroughChannels(start, end, fs, ts, fromEntry, toEntry, channelMap)
		const d = pointsToPath(pts, 8)

		// Approximate length from waypoints
		let len = 0
		for (let j = 0; j < pts.length - 1; j++) {
			len += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y)
		}

		segments.push({ d, sourceNode: from, targetNode: to, length: len })
	}

	return segments
}

/* ─── JS-driven traversal animation ─── */

function TraversalAnimation({
	anim,
	segments,
	containerEl,
	onActiveEdge,
}: {
	anim: AnimationDef
	segments: TraversalSegment[]
	containerEl: HTMLDivElement
	onActiveEdge: (from: string | null, to: string | null) => void
}) {
	const dotRef = useRef<SVGCircleElement>(null)
	const prevActiveRef = useRef<string | null>(null)
	const prevEdgeRef = useRef<string | null>(null)
	const segRef = useRef(segments)
	segRef.current = segments
	const onActiveEdgeRef = useRef(onActiveEdge)
	onActiveEdgeRef.current = onActiveEdge

	useEffect(() => {
		const segs = segRef.current
		if (segs.length === 0 || !dotRef.current) return

		// Pre-create SVG paths for getPointAtLength
		const svgNs = 'http://www.w3.org/2000/svg'
		const tmpSvg = document.createElementNS(svgNs, 'svg')
		tmpSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
		document.body.appendChild(tmpSvg)

		const pathEls = segs.map((seg) => {
			const p = document.createElementNS(svgNs, 'path')
			p.setAttribute('d', seg.d)
			tmpSvg.appendChild(p)
			return p
		})

		const pathLens = pathEls.map((p) => p.getTotalLength())

		const travelDur = anim.speed * 1000
		const pauseDur = 800
		const segCycle = travelDur + pauseDur
		const totalCycle = segs.length * segCycle

		let running = true
		let startTime: number | null = null

		function tick(now: number) {
			if (!running || !dotRef.current) return

			if (startTime === null) startTime = now

			const elapsed = anim.loop
				? (now - startTime) % totalCycle
				: Math.min(now - startTime, totalCycle)

			const segIdx = Math.min(Math.floor(elapsed / segCycle), segs.length - 1)
			const segElapsed = elapsed - segIdx * segCycle
			const seg = segs[segIdx]

			if (segElapsed < travelDur) {
				// Traveling along edge
				const progress = segElapsed / travelDur
				// Ease in-out for natural movement
				const eased = progress < 0.5
					? 2 * progress * progress
					: 1 - (-2 * progress + 2) ** 2 / 2
				const pathEl = pathEls[segIdx]
				const pathLen = pathLens[segIdx]

				if (pathEl && pathLen > 0) {
					const pt = pathEl.getPointAtLength(eased * pathLen)
					dotRef.current.setAttribute('cx', String(pt.x))
					dotRef.current.setAttribute('cy', String(pt.y))
					dotRef.current.setAttribute('opacity', '0.6')
				}

				// Mark edge as active
				const edgeKey = `${seg.sourceNode}-${seg.targetNode}`
				if (prevEdgeRef.current !== edgeKey) {
					prevEdgeRef.current = edgeKey
					onActiveEdgeRef.current(seg.sourceNode, seg.targetNode)
				}

				// Deactivate node immediately when dot starts moving
				if (prevActiveRef.current) {
					const el = containerEl.querySelector(`[data-flow-node="${prevActiveRef.current}"]`) as HTMLElement | null
					el?.removeAttribute('data-flow-active')
					prevActiveRef.current = null
				}
			} else {
				// Paused at node — dot hidden, node highlighted
				dotRef.current.setAttribute('opacity', '0')

				if (prevActiveRef.current !== seg.targetNode) {
					if (prevActiveRef.current) {
						const prev = containerEl.querySelector(`[data-flow-node="${prevActiveRef.current}"]`) as HTMLElement | null
						prev?.removeAttribute('data-flow-active')
					}
					const el = containerEl.querySelector(`[data-flow-node="${seg.targetNode}"]`) as HTMLElement | null
					el?.setAttribute('data-flow-active', '')
					prevActiveRef.current = seg.targetNode
				}

				if (prevEdgeRef.current) {
					prevEdgeRef.current = null
					onActiveEdgeRef.current(null, null)
				}
			}

			if (running) requestAnimationFrame(tick)
		}

		const raf = requestAnimationFrame(tick)

		return () => {
			running = false
			cancelAnimationFrame(raf)
			tmpSvg.remove()
			// Cleanup
			if (prevActiveRef.current) {
				const el = containerEl.querySelector(`[data-flow-node="${prevActiveRef.current}"]`) as HTMLElement | null
				el?.removeAttribute('data-flow-active')
			}
			onActiveEdge(null, null)
		}
	// Only restart animation when segment count changes (structural change), not on every re-render
	}, [segments.length, anim.speed, anim.loop, containerEl])

	return (
		<circle
			ref={dotRef}
			r={anim.radius}
			fill={anim.color ?? 'var(--primary)'}
			opacity="0"
		/>
	)
}

/* ─── Edge + Animation Renderer ─── */

type EdgeRoute = {
	edge: EdgeDef
	d: string
	midPt: Pt
	perpX: number
	perpY: number
}

function EdgeLayer({
	edges,
	animations,
	nodeMap,
	containerEl,
	gap,
}: {
	edges: EdgeDef[]
	animations: AnimationDef[]
	nodeMap: NodeMap
	containerEl: HTMLDivElement
	gap: number
}) {
	const [, setTick] = useState(0)
	const [activeEdgeKey, setActiveEdgeKey] = useState<string | null>(null)

	useEffect(() => {
		const obs = new ResizeObserver(() => setTick((t) => t + 1))
		obs.observe(containerEl)
		return () => obs.disconnect()
	}, [containerEl])

	const cRect = containerEl.getBoundingClientRect()
	const channelMap = buildChannelMap(nodeMap, gap)

	// Pre-compute all edge routes
	const edgeRoutes: EdgeRoute[] = edges.map((edge) => {
		const fromEntry = nodeMap.get(edge.from)
		const toEntry = nodeMap.get(edge.to)
		if (!fromEntry || !toEntry) return null!

		const { fs, ts } = inferSidesFromGrid(fromEntry, toEntry, edge.fromSide, edge.toSide)
		const start = anchor(fromEntry.rect, fs)
		const end = anchor(toEntry.rect, ts)
		const pts = routeEdgeThroughChannels(start, end, fs, ts, fromEntry, toEntry, channelMap)
		const d = pointsToPath(pts, 8)
		const { pt: midPt, angle: midAngle } = pathMidpoint(pts)

		return {
			edge,
			d,
			midPt,
			perpX: -Math.sin(midAngle) * 6,
			perpY: Math.cos(midAngle) * 6,
		}
	}).filter(Boolean)

	// Build traversal segments for animations — memoize to avoid resetting animation on re-render
	const animSegmentsRef = useRef<TraversalSegment[][]>([])
	const prevNodeMapSize = useRef(0)
	if (nodeMap.size !== prevNodeMapSize.current) {
		prevNodeMapSize.current = nodeMap.size
		animSegmentsRef.current = animations.map((anim) =>
			buildTraversalSegments(anim.path, edges, nodeMap, channelMap),
		)
	}
	const animSegments = animSegmentsRef.current

	// Callback from TraversalAnimation to highlight active edge
	const onActiveEdge = useCallback((from: string | null, to: string | null) => {
		setActiveEdgeKey(from && to ? `${from}-${to}` : null)
	}, [])

	return (
		<svg
			className="pointer-events-none absolute inset-0 overflow-visible"
			width={cRect.width}
			height={cRect.height}
		>
			{/* Edge lines */}
			{edgeRoutes.map((route) => {
				const key = `${route.edge.from}-${route.edge.to}`
				const isActive = key === activeEdgeKey

				return (
					<g key={key}>
						<path
							d={route.d}
							fill="none"
							stroke="currentColor"
							strokeWidth={isActive ? 1.5 : 1}
							opacity={isActive ? 0.35 : 0.1}
							style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
						/>
						{route.edge.label && (
							<text
								x={route.midPt.x + route.perpX}
								y={route.midPt.y + route.perpY}
								textAnchor="middle"
								className="font-mono"
								fill="currentColor"
								opacity={isActive ? 0.5 : 0.25}
								style={{
									fontSize: 8,
									letterSpacing: '0.14em',
									textTransform: 'uppercase',
									transition: 'opacity 0.3s',
								}}
							>
								{route.edge.label}
							</text>
						)}
					</g>
				)
			})}

			{/* Animated traversals */}
			{animations.map((anim, i) => (
				<TraversalAnimation
					key={i}
					anim={anim}
					segments={animSegments[i]}
					containerEl={containerEl}
					onActiveEdge={onActiveEdge}
				/>
			))}
		</svg>
	)
}

/* ─── FlowChart ─── */

export function FlowChart({
	children,
	cols = 3,
	gap = 12,
	className,
}: {
	children: ReactNode
	cols?: number
	gap?: number
	className?: string
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const gridRef = useRef<HTMLDivElement>(null)
	const [nodeMap, setNodeMap] = useState<NodeMap>(new Map())
	const [edgeDefs, setEdgeDefs] = useState<EdgeDef[]>([])
	const [animDefs, setAnimDefs] = useState<AnimationDef[]>([])
	const [mounted, setMounted] = useState(false)

	// Collect children by type
	const nodeElements: ReactElement[] = []
	const collectedEdges: EdgeDef[] = []
	const collectedAnims: AnimationDef[] = []

	Children.forEach(children, (child) => {
		if (!child || typeof child !== 'object' || !('type' in child)) return
		if ((child.type as any) === FlowEdge) {
			const p = (child as ReactElement<any>).props
			collectedEdges.push({
				from: p.from,
				to: p.to,
				label: p.label,
				fromSide: p.fromSide,
				toSide: p.toSide,
				dashed: p.dashed,
			})
		} else if ((child.type as any) === FlowAnimation) {
			const p = (child as ReactElement<any>).props
			collectedAnims.push({
				path: p.path,
				speed: p.speed ?? 0.8,
				color: p.color,
				radius: p.radius ?? 3,
				loop: p.loop ?? true,
			})
		} else {
			nodeElements.push(child as ReactElement)
		}
	})

	const measure = useCallback(() => {
		if (!containerRef.current || !gridRef.current) return

		const cRect = containerRef.current.getBoundingClientRect()
		const map: NodeMap = new Map()

		const els = gridRef.current.querySelectorAll<HTMLElement>('[data-flow-node]')
		for (const el of els) {
			const id = el.getAttribute('data-flow-node')!
			const r = el.getBoundingClientRect()
			map.set(id, {
				col: Number(el.getAttribute('data-flow-col')),
				row: Number(el.getAttribute('data-flow-row')),
				colSpan: Number(el.getAttribute('data-flow-colspan') ?? 1),
				rect: {
					x: r.left - cRect.left,
					y: r.top - cRect.top,
					w: r.width,
					h: r.height,
				},
			})
		}

		setNodeMap(map)
		setMounted(true)
	}, [])

	useEffect(() => {
		setEdgeDefs(collectedEdges)
		setAnimDefs(collectedAnims)
	}, [children])

	useEffect(() => {
		const raf = requestAnimationFrame(measure)
		return () => cancelAnimationFrame(raf)
	}, [measure])

	useEffect(() => {
		if (!containerRef.current) return
		const obs = new ResizeObserver(measure)
		obs.observe(containerRef.current)
		return () => obs.disconnect()
	}, [measure])

	return (
		<div ref={containerRef} className={cn('relative', className)}>
			<div
				ref={gridRef}
				className="grid"
				style={{
					gridTemplateColumns: `repeat(${cols}, 1fr)`,
					gap: `${gap}px`,
				}}
			>
				{nodeElements}
			</div>
			{mounted && containerRef.current && (
				<EdgeLayer
					edges={edgeDefs}
					animations={animDefs}
					nodeMap={nodeMap}
					containerEl={containerRef.current}
					gap={gap}
				/>
			)}
		</div>
	)
}

import type { SVGProps } from "react";

/**
 * Decorative field glyphs. The app declares no `lucide-react` dependency (it
 * lives only under @questpie/ui — see `lib/navigation/nav-icons.tsx`), so auth
 * and onboarding fields carry local stroke marks drawn on the kit's 16-grid,
 * with the exact geometry of the canonical auth wireframe. They are `aria-hidden`
 * — the adjacent <FieldLabel> is the accessible name — and inherit
 * `currentColor`, so an <InputGroupAddon> tints them muted like every other
 * field icon.
 */
type GlyphProps = SVGProps<SVGSVGElement>;

function MailGlyph(props: GlyphProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.3}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
			{...props}
		>
			<rect x="2" y="3.5" width="12" height="9" rx="2" />
			<path d="M2.5 5l5.5 4 5.5-4" />
		</svg>
	);
}

function LockGlyph(props: GlyphProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.3}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
			{...props}
		>
			<rect x="3" y="7" width="10" height="6.5" rx="1.5" />
			<path d="M5 7V5a3 3 0 0 1 6 0v2" />
		</svg>
	);
}

function UserGlyph(props: GlyphProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.3}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
			{...props}
		>
			<circle cx="8" cy="5.5" r="2.4" />
			<path d="M3.6 13c0-2.4 2-3.9 4.4-3.9s4.4 1.5 4.4 3.9" />
		</svg>
	);
}

export { LockGlyph, MailGlyph, UserGlyph };

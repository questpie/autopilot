import type { ReactElement, ReactNode, SVGProps } from "react";

import type { AttentionNavigationItem } from "@questpie/ui";

/**
 * The company shell's navigation items are typed with lucide's `LucideIcon`,
 * but this app declares no `lucide-react` dependency (it lives only under
 * @questpie/ui). We recover the exact icon type structurally from the kit's own
 * navigation contract, then satisfy it with local stroke glyphs — decorative,
 * `aria-hidden`, and rendered at the same 24-grid as the kit's icons.
 */
type NavIcon = AttentionNavigationItem["icon"];

type GlyphProps = SVGProps<SVGSVGElement>;

function Glyph({ children, ...props }: GlyphProps & { children: ReactNode }): ReactElement {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={20}
			height={20}
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
			{...props}
		>
			{children}
		</svg>
	);
}

const asNavIcon = (glyph: (props: GlyphProps) => ReactElement): NavIcon =>
	glyph as unknown as NavIcon;

export const HouseIcon = asNavIcon((props) => (
	<Glyph {...props}>
		<path d="M3 10.5 12 3l9 7.5" />
		<path d="M5 9.5V21h5v-6h4v6h5V9.5" />
	</Glyph>
));

export const InboxIcon = asNavIcon((props) => (
	<Glyph {...props}>
		<path d="M4 13h4l2 3h4l2-3h4" />
		<path d="M4 13 6 5h12l2 8v6H4z" />
	</Glyph>
));

export const ActivityIcon = asNavIcon((props) => (
	<Glyph {...props}>
		<path d="M3 12h4l3 8 4-16 3 8h4" />
	</Glyph>
));

export const LayersIcon = asNavIcon((props) => (
	<Glyph {...props}>
		<path d="m12 3 9 5-9 5-9-5 9-5Z" />
		<path d="m3 13 9 5 9-5" />
	</Glyph>
));

export const UsersIcon = asNavIcon((props) => (
	<Glyph {...props}>
		<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
		<path d="M2 21v-1a6 6 0 0 1 12 0v1" />
		<path d="M17 5.5a3 3 0 0 1 0 6M22 21v-1a6 6 0 0 0-4-5.6" />
	</Glyph>
));

export const SettingsIcon = asNavIcon((props) => (
	<Glyph {...props}>
		<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
		<path d="M19 12a7 7 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.3-1.3L13.8 2h-3.6l-.4 2.4a7 7 0 0 0-2.3 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.3 1.3l.4 2.4h3.6l.4-2.4a7 7 0 0 0 2.3-1.3l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z" />
	</Glyph>
));

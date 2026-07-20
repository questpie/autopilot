import type { Preview } from "@storybook/react-vite";

import "../src/styles.css";
import "./preview.css";

const preview: Preview = {
	parameters: {
		a11y: {
			test: "error",
			// Base UI focus sentinels are intentionally aria-hidden + tabbable so
			// keyboard focus can leave popups. Axe treats that implementation detail
			// as aria-hidden-focus, so scope it out without suppressing real controls.
			context: {
				include: ["body"],
				exclude: ["[data-base-ui-focus-guard]"],
			},
		},
		controls: { expanded: true },
		layout: "centered",
		viewport: {
			options: {
				mobile390: {
					name: "Mobile 390",
					styles: { width: "390px", height: "844px" },
					type: "mobile",
				},
				overlay767: {
					name: "Overlay below 768",
					styles: { width: "767px", height: "900px" },
					type: "mobile",
				},
				overlay768: {
					name: "Overlay at 768",
					styles: { width: "768px", height: "900px" },
					type: "tablet",
				},
				shell1023: {
					name: "Shell below 1024",
					styles: { width: "1023px", height: "900px" },
					type: "tablet",
				},
				shell1024: {
					name: "Shell at 1024",
					styles: { width: "1024px", height: "900px" },
					type: "desktop",
				},
				detail1179: {
					name: "Detail below 1180",
					styles: { width: "1179px", height: "900px" },
					type: "desktop",
				},
				detail1180: {
					name: "Detail at 1180",
					styles: { width: "1180px", height: "900px" },
					type: "desktop",
				},
				wide1440: {
					name: "Wide 1440",
					styles: { width: "1440px", height: "1000px" },
					type: "desktop",
				},
			},
		},
	},
	globalTypes: {
		theme: {
			description: "Farebná schéma",
			defaultValue: "light",
			toolbar: {
				icon: "paintbrush",
				items: ["light", "dark"],
			},
		},
		pointer: {
			description: "Vstupné zariadenie",
			defaultValue: "fine",
			toolbar: {
				icon: "pointerdefault",
				items: [
					{ value: "fine", title: "Presný pointer" },
					{ value: "coarse", title: "Dotykový pointer" },
				],
			},
		},
		motion: {
			description: "Preferencia pohybu",
			defaultValue: "full",
			toolbar: {
				icon: "lightning",
				items: [
					{ value: "full", title: "Plný pohyb" },
					{ value: "reduce", title: "Obmedzený pohyb" },
				],
			},
		},
		safeArea: {
			description: "Spodná bezpečná oblasť zariadenia",
			defaultValue: "0",
			toolbar: {
				icon: "mobile",
				items: [
					{ value: "0", title: "Bez bezpečnej oblasti" },
					{ value: "24", title: "Bezpečná oblasť 24 px" },
				],
			},
		},
	},
	decorators: [
		(Story, context) => {
			const dark = context.globals.theme === "dark";
			const coarse = context.globals.pointer === "coarse";
			const reducedMotion = context.globals.motion === "reduce";
			document.documentElement.dataset.theme = dark ? "dark" : "light";
			document.documentElement.dataset.pointer = coarse ? "coarse" : "fine";
			document.documentElement.dataset.reducedMotion = reducedMotion ? "reduce" : "full";
			document.documentElement.dataset.safeBottom = context.globals.safeArea === "24" ? "24" : "0";
			document.documentElement.classList.toggle("dark", dark);
			return (
				<div className="ui-preview">
					<Story />
				</div>
			);
		},
	],
};

export default preview;

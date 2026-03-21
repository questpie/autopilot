import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { Logo } from "@/components/logo";

export const gitConfig = {
	user: "questpie",
	repo: "questpie-autopilot",
	branch: "main",
};

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			url: "/",
			title: <Logo />,
			transparentMode: "always",
		},
		links: [
			{
				text: "QUESTPIE Framework",
				url: "https://questpie.com",
				external: true,
			},
			{
				text: "GitHub",
				url: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
				external: true,
			},
		],
	};
}

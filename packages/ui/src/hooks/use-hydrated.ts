import * as React from "react";

/**
 * Returns `false` during SSR and the first client render, then `true` after the
 * component has hydrated. Use it to mount-gate popup roots (base-ui Dialog /
 * Drawer / AlertDialog) whose stores are not server-renderable: SSR streams the
 * un-gated markup and the interactive popup upgrades post-hydration. The first
 * client render matches SSR, so there is no hydration mismatch.
 */
export function useHydrated(): boolean {
	const [hydrated, setHydrated] = React.useState(false);
	React.useEffect(() => {
		setHydrated(true);
	}, []);
	return hydrated;
}

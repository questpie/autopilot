import * as React from "react";

import {
	THEME_MEDIA_QUERY,
	THEME_STORAGE_KEY,
	isThemeName,
	readThemePreference,
	type ResolvedTheme,
	type ThemeName,
} from "./theme-contract";
import { ThemeScript } from "./theme-script";

interface ThemeContextValue {
	theme: ThemeName;
	resolvedTheme?: ResolvedTheme;
	setTheme: React.Dispatch<React.SetStateAction<ThemeName>>;
}

interface ThemeProviderProps extends React.PropsWithChildren {
	defaultTheme?: ThemeName;
	disableTransitionOnChange?: boolean;
	nonce?: string;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(theme: ThemeName, mediaQuery?: MediaQueryList): ResolvedTheme {
	if (theme !== "system") return theme;
	const media = mediaQuery ?? window.matchMedia(THEME_MEDIA_QUERY);
	return media.matches ? "dark" : "light";
}

function withoutTransitions() {
	const style = document.createElement("style");
	style.textContent = "*,*::before,*::after{transition:none!important}";
	document.head.append(style);
	window.getComputedStyle(document.body);
	return () => window.setTimeout(() => style.remove(), 1);
}

function applyTheme(theme: ThemeName, disableTransitionOnChange: boolean) {
	const resolvedTheme = resolveTheme(theme);
	const restoreTransitions = disableTransitionOnChange ? withoutTransitions() : undefined;
	const root = document.documentElement;

	root.classList.toggle("dark", resolvedTheme === "dark");
	root.dataset.theme = resolvedTheme;
	root.style.colorScheme = resolvedTheme;
	restoreTransitions?.();

	return resolvedTheme;
}

function writeStoredTheme(theme: ThemeName) {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// Storage may be unavailable in privacy-restricted browser contexts.
	}
}

function ThemeProvider({
	children,
	defaultTheme = "system",
	disableTransitionOnChange = true,
	nonce,
}: ThemeProviderProps) {
	const existingContext = React.useContext(ThemeContext);
	const [theme, setThemeState] = React.useState<ThemeName>(() => readThemePreference(defaultTheme));
	const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>();

	const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<ThemeName>>>(
		(nextTheme) => {
			setThemeState((currentTheme) => {
				const resolvedNext = typeof nextTheme === "function" ? nextTheme(currentTheme) : nextTheme;
				writeStoredTheme(resolvedNext);
				return resolvedNext;
			});
		},
		[],
	);

	React.useEffect(() => {
		setResolvedTheme(applyTheme(theme, disableTransitionOnChange));
	}, [disableTransitionOnChange, theme]);

	React.useEffect(() => {
		const media = window.matchMedia(THEME_MEDIA_QUERY);
		const handleSystemChange = () => {
			if (theme === "system") setResolvedTheme(applyTheme(theme, disableTransitionOnChange));
		};
		media.addEventListener("change", handleSystemChange);
		return () => media.removeEventListener("change", handleSystemChange);
	}, [disableTransitionOnChange, theme]);

	React.useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== THEME_STORAGE_KEY) return;
			setThemeState(isThemeName(event.newValue) ? event.newValue : defaultTheme);
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [defaultTheme]);

	const value = React.useMemo(
		() => ({ theme, resolvedTheme, setTheme }),
		[resolvedTheme, setTheme, theme],
	);

	if (existingContext) return children;

	return (
		<ThemeContext.Provider value={value}>
			<ThemeScript nonce={nonce} defaultTheme={defaultTheme} />
			{children}
		</ThemeContext.Provider>
	);
}

function useTheme() {
	const context = React.useContext(ThemeContext);
	if (!context) throw new Error("useTheme must be used within ThemeProvider");
	return context;
}

export { ThemeProvider, useTheme };
export type { ThemeProviderProps };

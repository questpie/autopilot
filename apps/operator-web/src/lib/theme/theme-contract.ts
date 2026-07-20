export const THEME_STORAGE_KEY = "questpie-autopilot-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const themeNames = ["light", "dark", "system"] as const;

export type ThemeName = (typeof themeNames)[number];
export type ResolvedTheme = Exclude<ThemeName, "system">;

export function isThemeName(value: string | null): value is ThemeName {
	return value !== null && themeNames.some((theme) => theme === value);
}

export function readThemePreference(
	fallback: ThemeName,
	readPreference: () => string | null = () => globalThis.localStorage.getItem(THEME_STORAGE_KEY),
): ThemeName {
	try {
		const storedTheme = readPreference();
		return isThemeName(storedTheme) ? storedTheme : fallback;
	} catch {
		return fallback;
	}
}

import { describe, expect, test } from "bun:test";

import { readThemePreference } from "../../src/lib/theme/theme-contract";
import { createThemeInitializer } from "../../src/lib/theme/theme-script";

interface ThemeDomState {
	dark: boolean;
	dataTheme?: string;
	colorScheme?: string;
}

function runThemeScript({
	storedTheme,
	systemDark = false,
	storageThrows = false,
	defaultTheme,
}: {
	storedTheme?: string;
	systemDark?: boolean;
	storageThrows?: boolean;
	defaultTheme?: "light" | "dark" | "system";
}) {
	const state: ThemeDomState = { dark: false };
	const root = {
		classList: {
			toggle: (_name: string, force: boolean) => {
				state.dark = force;
			},
		},
		dataset: new Proxy<Record<string, string>>(
			{},
			{
				set: (target, property, value: string) => {
					target[String(property)] = value;
					state.dataTheme = value;
					return true;
				},
			},
		),
		style: new Proxy<Record<string, string>>(
			{},
			{
				set: (target, property, value: string) => {
					target[String(property)] = value;
					state.colorScheme = value;
					return true;
				},
			},
		),
	};
	const execute = new Function(
		"document",
		"window",
		"localStorage",
		createThemeInitializer("test-theme", defaultTheme),
	);

	execute(
		{ documentElement: root },
		{ matchMedia: () => ({ matches: systemDark }) },
		{
			getItem: () => {
				if (storageThrows) throw new Error("storage unavailable");
				return storedTheme ?? null;
			},
		},
	);

	return state;
}

describe("TanStack Start pre-hydration theme script", () => {
	test("hydrates from the stored preference and fails closed to the configured fallback", () => {
		expect(readThemePreference("system", () => "dark")).toBe("dark");
		expect(readThemePreference("light", () => "sepia")).toBe("light");
		expect(
			readThemePreference("system", () => {
				throw new Error("storage unavailable");
			}),
		).toBe("system");
	});

	test("applies a stored dark preference before hydration", () => {
		expect(runThemeScript({ storedTheme: "dark" })).toEqual({
			dark: true,
			dataTheme: "dark",
			colorScheme: "dark",
		});
	});

	test("resolves system preference instead of persisting a fake resolved value", () => {
		expect(runThemeScript({ storedTheme: "system", systemDark: true }).dark).toBe(true);
		expect(runThemeScript({ storedTheme: "system", systemDark: false }).dark).toBe(false);
	});

	test("falls back to system when storage is invalid or unavailable", () => {
		expect(runThemeScript({ storedTheme: "sepia", systemDark: true }).dark).toBe(true);
		expect(runThemeScript({ storageThrows: true, systemDark: false }).dark).toBe(false);
	});

	test("uses the configured app default over the OS preference (light-first)", () => {
		// Warm-paper light is the brand default: a dark-OS visitor still gets light
		// until they explicitly opt into dark, and an invalid stored value resolves to
		// that default rather than following the system query.
		expect(runThemeScript({ defaultTheme: "light", systemDark: true }).dark).toBe(false);
		expect(
			runThemeScript({ storedTheme: "sepia", defaultTheme: "light", systemDark: true }).dark,
		).toBe(false);
		// An explicit stored preference always wins over the default.
		expect(runThemeScript({ storedTheme: "dark", defaultTheme: "light" }).dark).toBe(true);
	});
});

import { THEME_MEDIA_QUERY, THEME_STORAGE_KEY, type ThemeName } from "./theme-contract";

interface ThemeScriptProps {
	nonce?: string;
	defaultTheme?: ThemeName;
}

function createThemeInitializer(storageKey: string, defaultTheme: ThemeName = "system") {
	return `(() => {
  const root = document.documentElement;
  const storageKey = ${JSON.stringify(storageKey)};
  let preference = ${JSON.stringify(defaultTheme)};

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch {}

  const resolved = preference === "system"
    ? (window.matchMedia(${JSON.stringify(THEME_MEDIA_QUERY)}).matches ? "dark" : "light")
    : preference;

  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
})();`;
}

function ThemeScript({ nonce, defaultTheme }: ThemeScriptProps) {
	return (
		<script
			nonce={nonce}
			suppressHydrationWarning
			// The pre-hydration script applies the stored preference (or the app's
			// configured default) before paint so there is no theme flash. The default
			// flows in from ThemeProvider so the script and React state never disagree.
			dangerouslySetInnerHTML={{
				__html: createThemeInitializer(THEME_STORAGE_KEY, defaultTheme),
			}}
		/>
	);
}

export { createThemeInitializer, ThemeScript };

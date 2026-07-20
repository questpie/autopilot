import { THEME_MEDIA_QUERY, THEME_STORAGE_KEY } from "./theme-contract";

interface ThemeScriptProps {
	nonce?: string;
}

function createThemeInitializer(storageKey: string) {
	return `(() => {
  const root = document.documentElement;
  const storageKey = ${JSON.stringify(storageKey)};
  let preference = "system";

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

function ThemeScript({ nonce }: ThemeScriptProps) {
	return (
		<script
			nonce={nonce}
			suppressHydrationWarning
			// The pre-hydration script is required to apply the stored/system theme before paint.
			dangerouslySetInnerHTML={{ __html: createThemeInitializer(THEME_STORAGE_KEY) }}
		/>
	);
}

export { createThemeInitializer, ThemeScript };

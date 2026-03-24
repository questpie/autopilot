# Dashboard Overrides

Place `theme.css` here to override the Living Dashboard design tokens.

```css
:root {
  --primary: oklch(0.6 0.2 250);
  --font-sans: 'CustomFont', 'Inter', sans-serif;
  --radius: 0.5rem;
}
```

Agents can edit this file. Changes appear instantly via HMR. Run `autopilot dashboard reset` to restore defaults.

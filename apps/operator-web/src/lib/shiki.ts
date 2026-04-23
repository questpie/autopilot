import { bundledLanguages, createHighlighter, createJavaScriptRegexEngine, type ThemedToken } from 'shiki'

export type ShikiThemeName = 'github-dark-default' | 'github-light-default'

const SHIKI_THEMES: ShikiThemeName[] = ['github-dark-default', 'github-light-default']
const DEFAULT_LANGUAGE = 'text'

type ShikiLanguageName = keyof typeof bundledLanguages

const loadedLanguages = new Set<string>([DEFAULT_LANGUAGE])
const tokenCache = new Map<string, ThemedToken[][]>()
let highlighterPromise: ReturnType<typeof createHighlighter> | null = null

function setTokenCache(key: string, tokens: ThemedToken[][]) {
  tokenCache.set(key, tokens)

  if (tokenCache.size <= 200) return

  const oldestKey = tokenCache.keys().next().value
  if (oldestKey) tokenCache.delete(oldestKey)
}

function normalizeShikiLanguage(language?: string | null): ShikiLanguageName | typeof DEFAULT_LANGUAGE {
  const normalized = language?.trim().toLowerCase()
  if (!normalized) return DEFAULT_LANGUAGE

  if (normalized in bundledLanguages) {
    return normalized as ShikiLanguageName
  }

  return DEFAULT_LANGUAGE
}

export function resolveShikiTheme(): ShikiThemeName {
  if (typeof document === 'undefined') return 'github-dark-default'
  return document.documentElement.classList.contains('light')
    ? 'github-light-default'
    : 'github-dark-default'
}

export function formatCodeLanguageLabel(language?: string | null): string {
  const normalized = normalizeShikiLanguage(language)
  if (normalized === DEFAULT_LANGUAGE) return 'plain text'

  return normalized
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function highlightCodeTokens(
  code: string,
  language: string | null | undefined,
  theme: ShikiThemeName,
): Promise<ThemedToken[][]> {
  const normalizedLanguage = normalizeShikiLanguage(language)
  const cacheKey = `${theme}\u0000${normalizedLanguage}\u0000${code}`
  const cached = tokenCache.get(cacheKey)
  if (cached) return cached

  highlighterPromise ??= createHighlighter({
    themes: SHIKI_THEMES,
    langs: [DEFAULT_LANGUAGE],
    engine: createJavaScriptRegexEngine(),
  })

  const highlighter = await highlighterPromise

  if (!loadedLanguages.has(normalizedLanguage)) {
    await highlighter.loadLanguage(normalizedLanguage)
    loadedLanguages.add(normalizedLanguage)
  }

  const tokens = highlighter.codeToTokens(code, {
    lang: normalizedLanguage,
    theme,
  }).tokens

  setTokenCache(cacheKey, tokens)
  return tokens
}

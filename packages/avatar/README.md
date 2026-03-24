# @questpie/avatar

Deterministic generative construct avatars — 2M+ unique variations from any seed string. Given the same seed, the same avatar is always produced.

## Install

```bash
bun add @questpie/avatar
```

## Usage

### SVG generation (core)

```ts
import { generateAvatar } from '@questpie/avatar'

const svg = generateAvatar('agent-alpha')
// Returns an SVG string
```

### React component

```tsx
import { Avatar } from '@questpie/avatar/react'

<Avatar seed="agent-alpha" size={64} />
```

## Exports

| Entry point | Description |
| --- | --- |
| `@questpie/avatar` | Core SVG generation — zero runtime dependencies |
| `@questpie/avatar/react` | React component wrapper — requires `react >= 18` as peer dependency |

## Links

- [GitHub](https://github.com/questpie/autopilot)

## License

MIT

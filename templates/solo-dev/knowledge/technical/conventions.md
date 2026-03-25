# Technical Conventions

> Coding standards and technical decisions for this company.
> Update this document as conventions evolve.

## Stack

> **Edit this section** to match your actual tech stack.

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Formatting:** Biome (tabs, single quotes, no semicolons)
- **Package Manager:** Bun
- **Testing:** Bun test runner
- **VCS:** Git with conventional commits

## Code Style

- No `any` types — use proper TypeScript types or Zod schemas
- Prefer `const` over `let`, never use `var`
- Use template literals over string concatenation
- Prefer early returns over deep nesting
- Keep functions small (< 50 lines ideally)
- Name files in kebab-case: `my-component.ts`

## Git Conventions

- **Branch naming:** `feat/description`, `fix/description`, `chore/description`
- **Commit messages:** Conventional commits
  - `feat: add user authentication`
  - `fix: resolve login redirect loop`
  - `docs: update API documentation`
  - `chore: upgrade dependencies`
  - `refactor: extract auth middleware`
- **PR descriptions:** Reference task ID, describe what changed and why
- **Keep PRs focused:** One feature/fix per PR, under 200 lines when possible

## File Organization

- Group by feature, not by type
- Colocate tests with source files (`*.test.ts` next to `*.ts`)
- Use barrel exports (`index.ts`) for public APIs
- Keep imports organized: external → internal → relative

## Error Handling

- Use typed errors, not string throws
- Log errors with context (what was being attempted)
- Fail fast — validate inputs at boundaries
- Don't swallow errors silently

## Documentation

- Add JSDoc comments to public functions
- Keep README.md up to date
- Document non-obvious decisions in code comments (why, not what)

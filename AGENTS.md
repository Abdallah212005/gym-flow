<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## GymFlow project guidelines

- Keep the Arabic-first interface RTL and verify both desktop and mobile layouts when changing UI.
- Treat `src/app/globals.css` as the single source of truth for shared styling. Edit the existing component rules and design-token section; do not append competing overrides or duplicate selectors.
- Use the existing CSS custom properties for colors, surfaces, borders, and typography. Add or change tokens in one canonical `:root` block, then consume them across components.
- Preserve existing routes, authentication, permissions, API contracts, and data behavior during visual redesigns. Do not replace real data or flows with demo-only behavior.
- Reuse existing shared components and page patterns before introducing new ones. Keep styling changes scoped to the component or shared design tokens they intentionally affect.
- Avoid inline styles for static presentation. Existing data-driven chart sizing may remain inline where values are computed at runtime.
- Before finishing UI work, check for duplicate/conflicting selectors, run ESLint and TypeScript checks, and run a production build when practical.

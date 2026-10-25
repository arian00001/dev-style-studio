# Dev Style Studio

A mobile-first development studio: upload a ZIP project, review its files, pick or create a
GitHub repository, push it, then build an Android APK through GitHub Actions or deploy a
website to Vercel / GitHub Pages — all from a phone.

## Stack

- React 19 + TanStack Start (file-based routes, server functions, server routes)
- Tailwind CSS with a token-based design system (`src/index.css` + `tailwind.config.js`)
- Base44 backend: entities, auth, server-side integrations

## Workflow

`Upload → Files → Repository → Push → Build/Deploy → Ship`

The visual flow builder lives at `/flow`.

## Run locally

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Environment

Integration keys (GitHub, Gemini, Vercel) are stored as server-side secrets, never in the
client bundle. Configure them in the Base44 Secrets page.

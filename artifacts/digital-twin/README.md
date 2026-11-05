# Ozy digital-twin demo

A React + Vite + TypeScript single-page app: the customer-facing Ozy demo, shown as a **blank construct** that the team tailors to one lead at a time in **`/prepare`**.

**Start here:** [docs/LEAD-DEMO.md](docs/LEAD-DEMO.md). It covers preparing, storing, resetting and removing a lead case, the team password, the visual vocabulary and the development-only visual preview.

## Routes

| Route | What it is |
|---|---|
| `/disclaimer` | Entry and consent. `/` redirects here, or to `/questionnaire` once accepted. |
| `/questionnaire` | Onboarding: the intake answers of the active lead case (read-only). |
| `/twin` | The organisational model: isometric map, labelled systems view and list view of one composed state, key risks, and two bottom menus — run a prepared scenario (typed or picked) and compare / preview the options. |
| `/upload` | Data management: numbers, sources and simulated uploads. |
| `/pathways` | Up to three pathway options with an illustrative timeline. |
| `/executive-brief` | The downloadable brief. |
| `/brief` | Wrap-up: LOI signing and "Stay in touch". |
| `/prepare` | **Team only, password-protected.** The editor for lead cases, including "Start from a demo case" presets. |
| `/dev/visual-preview` | **Development builds only.** Visual vocabulary preview with synthetic data. |

The older v1 routes (`/demo`, `/pocket`, `/map`, `/artifact`, `/profile`, `/thank-you`) and the code only they used were removed in November 2026. They are still in git history.

## Run locally

On your own computer (macOS, Windows or Linux), from the repository root (see `START-HERE.md`):

```bash
pnpm install
pnpm demo
```

The Replit-style command still works too:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/digital-twin run dev
```

The Vite dev server proxies `/api/*` to the API server on port 8080 (`pnpm --filter @workspace/api-server run dev`). Without it, the LOI, contact and password endpoints are unavailable. Development builds always offer "Continue without a password" on `/prepare`, and production builds never do.

## Server endpoints

On Vercel, `api/*.ts` adapts each handler in `src/app/api/<name>/route.ts`. For local development, `artifacts/api-server/src/routes/` mirrors them.

| Endpoint | Purpose | Environment variables |
|---|---|---|
| `POST /api/sign-loi` | Builds the signed LOI PDF and emails it to the signer and to Ozyntel. The subject names the organisation. | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO_INTERNAL` (default hello@ozyntel.com), `EMAIL_REPLY_TO` |
| `POST /api/submit-crm` | "Stay in touch": a confirmation to the visitor, plus a notification to Ozyntel naming the organisation. LOI submissions are skipped here because sign-loi emails them. | same as above |
| `POST /api/prepare-unlock` | Checks the `/prepare` team password. Fails closed when the password isn't set. | `PREPARE_PASSWORD` (at least 10 characters) |

With `RESEND_API_KEY` or `EMAIL_FROM` missing, both email endpoints skip sending and still return `ok`.

## Checks

```bash
pnpm --filter @workspace/digital-twin run typecheck
pnpm --filter @workspace/digital-twin run test
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/digital-twin run build && pnpm --filter @workspace/digital-twin run check:dist
```

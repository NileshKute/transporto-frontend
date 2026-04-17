# Frontend Cleanup Audit — 2026-04-02

Audit scope: `D:\web_app\transporto-backend\transporto\frontend`. No files were deleted or modified for this report. Protected areas (quotations, GPS, WhatsApp, `src/lib/api/*`, `src/components/ui/*`, auth, config, selected public assets) were **not** changed—only observed.

**Note:** There is no `src/app/(dashboard)/gps-tracking/` folder in this repo; live GPS is under `src/app/(dashboard)/gps/`.

---

## A. Unused Pages / Components

### Routes vs dashboard sidebar

Dashboard nav is defined in `src/app/(dashboard)/layout.tsx` (`navGroups` + `adminNavGroup`). Every dashboard `page.tsx` under `src/app/(dashboard)/` maps to a sidebar item, a sub-route of one (e.g. `/bpcl/import`), or an admin route—**except**:

| Route | Role |
| --- | --- |
| `/trips/daily-log` | **Redirect only** — `redirect('/trips?tab=daily')` in `src/app/(dashboard)/trips/daily-log/page.tsx`. Keeps old URLs working; not linked in sidebar. |
| `/track/[token]` | **Public share** — no sidebar; intended for external links. |

### Public / auth (not in dashboard sidebar)

| Route | Linked from |
| --- | --- |
| `/`, `/about`, `/services`, `/contact`, `/fleet` | `PublicNav`, `PublicFooter`, `HomePageContent` |
| `/login` | Public nav + post-auth redirect target |

**Conclusion:** No obvious “dead” app routes; `trips/daily-log` is a thin compatibility redirect.

### `src/components/` — unused React modules

All checked component files under `src/components/` are imported from at least one `page.tsx`, layout, or another component (including dynamic `import()` on `gps/page.tsx` and `track/[token]/page.tsx`). **No orphan component `.tsx` files found.**

### Orphan filename patterns

Searched for `*.old.tsx`, `*.backup.tsx`, `*_v1.tsx`, `*_deprecated.tsx`: **none found.**

---

## B. Extra Folders at Root

Repo root contains only typical Next.js artifacts plus docs:

- **Standard:** `.next/`, `node_modules/`, `public/`, `src/`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `.gitignore`, `.env.production`, `README.md`, `next-env.d.ts`
- **Extra (non-code):** `WHATSAPP-BACKEND-IMPROVEMENTS.md`, `WHATSAPP-INTEGRATION-TASK.md` — planning notes, not app code. **Optional cleanup:** move to `/docs` or archive if you want a cleaner root.

No unrelated app folders (e.g. second project) at frontend root.

---

## C. Unused Imports

**Method:** `npx eslint .` (project ESLint; includes `@typescript-eslint/no-unused-vars`).

**`@typescript-eslint/no-unused-vars` warnings: 17** (mostly unused Lucide icons and unused named imports from `@/lib/utils` / `@/lib/displayText`).

| File | Unused (per ESLint) |
| --- | --- |
| `src/app/(dashboard)/clients/page.tsx` | `Building2` |
| `src/app/(dashboard)/cold-storage/[id]/page.tsx` | `formatDateTime` |
| `src/app/(dashboard)/cold-storage/page.tsx` | `Zap` |
| `src/app/(dashboard)/driver-ledger/page.tsx` | `Banknote`, `Hash` |
| `src/app/(dashboard)/drivers/page.tsx` | `formatDate`, `displayText`, `isError` (destructured) |
| `src/app/(dashboard)/emergencies/page.tsx` | `formatDate`, `AlertTriangle` |
| `src/app/(dashboard)/fuel/page.tsx` | `TrendingUp` |
| `src/app/(dashboard)/insurance/page.tsx` | `Shield` |
| `src/app/(dashboard)/layout.tsx` | `ChevronRight` |
| `src/app/(dashboard)/whatsapp/page.tsx` | `e` (catch param), `_` |
| `src/components/trips/DailyTripLogPanel.tsx` | `ok` (assigned) |
| `src/lib/emailTemplate.ts` | `_subject` (parameter; file unused overall—see G/E) |

**Rough cleanup:** ~17 import lines / bindings (plus removing dead `emailTemplate.ts` would drop its unused param).

ESLint also reports many **other** issues (e.g. `no-explicit-any`, React hooks rules); this audit only lists **unused-vars** for section C.

---

## D. Unused Dependencies

**Command:** `npx depcheck`

**Reported unused dependencies**

| Package | Depcheck says | Reality check |
| --- | --- | --- |
| `@hookform/resolvers` | Unused | **Confirmed:** no `react-hook-form` / `useForm` / `zod` usage in `src/`. |
| `react-hook-form` | Unused | Same. |
| `zod` | Unused | Same. |
| `@tanstack/react-query-devtools` | Unused | **Confirmed:** not imported in `providers.tsx` or elsewhere. |

**Reported unused devDependencies**

| Package | Depcheck says | Reality check |
| --- | --- | --- |
| `tailwindcss` | Unused | **False positive** — used via PostCSS / build; do not remove without replacing styling pipeline. |
| `@tailwindcss/postcss` | Unused | **False positive** — referenced from `postcss.config.mjs`. |
| `@types/node` | Unused | **False positive** — Node types for Next/TS tooling. |
| `@types/react-dom` | Unused | **False positive** — standard for React 19 + TS. |

**Safe candidates to uninstall (if you approve):** `@hookform/resolvers`, `react-hook-form`, `zod`, `@tanstack/react-query-devtools` — **after** you confirm no planned forms migration to RHF/Zod.

---

## E. Duplicate Code

| Finding | Detail |
| --- | --- |
| **`displayText` pattern** | `src/lib/displayText.ts` is the shared helper. `src/app/(dashboard)/clients/page.tsx` defines a **local** `displayText()` (~same idea). Consolidation would reduce duplication but is a refactor, not a delete. |
| **API clients** | Primary HTTP client: `src/lib/api.ts`. Quotations-specific wrapper: `src/lib/api/quotations.ts` only. **No duplicate quotation client files.** |
| **Alternate component versions** | No `QuotationForm_old`, backups, or `_v1` files found. |

---

## F. Commented Code Blocks

Automated scan did not find large **commented-out** implementation blocks (>5 lines of dead code) in `.tsx` files. Files use short `/** … */` docs, `{/* … */}` JSX section labels, and occasional one-line `//` section headers (e.g. `whatsapp/page.tsx` `// --- Types ---`).

**Not flagged as “large commented legacy code.”** Deeper manual review could still find small stale snippets.

---

## G. Unused Public Assets

Searched code references to paths under `public/`.

| Asset | Status |
| --- | --- |
| `public/images/fleet/*.jpg` (all listed images) | **Referenced** — `FleetPhotoGallery`, `HomePageContent`, public pages (`about`, `services`, `contact`, `fleet`). |
| `public/images/fleet/.gitkeep` | Placeholder; negligible size. |
| `public/file.svg` | **No references** in `src/` (likely Next.js template leftover). |
| `public/window.svg` | **No references** in `src/`. |
| `public/vercel.svg` | **No references** in `src/`. |

**Protected per your instructions (not evaluated for removal):** branding assets you listed (`public/logo.png`, `public/favicon.ico`, fonts) — `favicon` / app icon in this project also live under `src/app/` (`favicon.ico`, `icon.png`); confirm which paths you treat as canonical.

---

## I. Old Test Files

Searched `**/*.{test,spec}.{tsx,ts}` under the frontend project: **none found.**

---

## J. Dead API Routes / Clients

**`src/lib/api/quotations.ts`** — every exported method is referenced from quotations pages or form/import:

`list`, `get`, `create`, `update`, `updateStatus`, `convertToInvoice`, `delete`, `downloadPdf`, `getStats`, `import`, `importFile`, `reparseHistorical`.

**Static proof of backend existence** was **not** verified (would require backend audit). `DailyTripLogPanel` surfaces copy about `GET /trips/daily-log` possibly missing—that is **runtime/API** concern, not an unused frontend client file.

---

## Summary (estimates — for planning only)

| Metric | Estimate |
| --- | --- |
| **Files removable (if you approve)** | **1** definite orphan: `src/lib/emailTemplate.ts`. **3** likely safe SVG removals: `public/file.svg`, `public/window.svg`, `public/vercel.svg`. Optional: **2** root markdown files (docs only). |
| **Estimated space saved** | **&lt; 0.1 MB** for TS + SVGs; fleet JPGs are in use. |
| **Estimated LOC reduction** | ~**40** lines if removing `emailTemplate.ts`; ~**17** lines for unused import cleanups; SVGs negligible. |
| **Dependencies to uninstall (candidates)** | **4** if confirmed: `@hookform/resolvers`, `react-hook-form`, `zod`, `@tanstack/react-query-devtools`. **Do not** remove Tailwind / PostCSS types on depcheck alone. |

---

## H. Unused CSS / Tailwind

Skipped per your instructions.

---

## Next steps (after your approval)

1. Approve categories (e.g. D vs G vs `emailTemplate.ts`) one by one.  
2. After changes: run `npm run build` to verify.  
3. This audit did **not** run `git commit` or `git push`.

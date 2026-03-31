# Pipeline view — UI review & revamp plan

This document reviews two reference UIs (mobile list + Kanban board), compares them to the current FieldOps **Pipeline** tab, and proposes a phased revamp aligned with [app_design.md](app_design.md), [designsystem.md](designsystem.md), and the existing **opportunity** model.

---

## 1. Reference UI A — mobile “lead list” (search + chips + cards)

**What it does well**

- **Search** — Prominent pill search (“Search leads”) sets expectation that the list scales; reduces scroll-hunting.
- **Stage filters** — Horizontal **Filter by stage** chips (`All`, `New`, `Contacted`, …) give one-tap segmentation without leaving the screen.
- **Card hierarchy** — Each lead is a **card** (not a single text row): avatar, **name + company**, **email/phone** with icons, **last activity** and **confidence %**, **stage pill**, **deal value** — scannable in seconds.
- **Primary action** — Corner control (arrow) suggests “open record”; consistent with drill-down to detail.

**Caveats for Luna BMS**

- **Confidence / probability** — Our schema has `opportunity.status`, `estimated_value`, `captured_at`, and contact fields; we do **not** yet store a win-probability field. This can be **v2** (computed heuristic or explicit field) or omitted initially.
- **Avatars** — No `photo_url` on clients/opportunities today; we can use **initials** in a circle (on-brand) until media sync exists.
- **Currency** — Reference uses `$`; product standard is **UGX** (already in app).

---

## 2. Reference UI B — Kanban “pipeline board” (columns + drag-and-drop)

**What it does well**

- **Stage = columns** — Each stage is a vertical lane with a **colored header**, making pipeline state spatially obvious.
- **Column metrics** — Per-column **totals** (and in the reference, **rejected** counts) answer “how heavy is this stage?” at a glance.
- **Drag-and-drop** — Moving a card between columns maps directly to **changing stage** — fast for power users (sales/owners).
- **Card density** — Photo, name, location/phone, badges (`New`, `Followed`), rating — supports triage without opening every record.

**Caveats for Luna BMS**

- **Platform split** — **React Native** Kanban + DnD is non-trivial (`react-native-reanimated`, `react-native-gesture-handler`, or platform-specific web drag APIs). **Web** can use CSS/grid + HTML5 DnD or a library earlier than native.
- **Mobile vs desktop** — Full Kanban on **narrow phones** is cramped; reference B is often **tablet/desktop-first**. Plan: **list + chips on mobile**, **Kanban optional** on wide viewport / web (matches our responsive drawer pattern).
- **Bulk actions** — Reference checkboxes + “bulk” flows are powerful but add **selection state** and **batch APIs** — defer to a later phase unless pilot demand is clear.

---

## 3. Current FieldOps pipeline (baseline)

| Area | Today (`pipeline/index.js`) |
|------|-----------------------------|
| Layout | Single **EntityList** — one concatenated string per row (`captured_at · name · status · value`). |
| Search | **None** |
| Filters | **None** on list (stage only inside **New opportunity** modal). |
| Cards | **None** — no avatar, no contact lines, no stage badge on list row. |
| Detail | **Opportunity detail** — quotations, accept → project; solid for **Flow A** but list feels like a spreadsheet export. |

**Strengths to preserve**

- **FAB `+ New Opp`** and modal fields aligned with **opportunity** + **client** linking.
- **Navigation** to `pipeline/[id]` — keep drill-down.
- **Statuses** (`OPPORTUNITY_PIPELINE_STATUSES`: Prospecting → Closing) — **rename** only with a migration + migration of existing values if we align labels to marketing language.

---

## 4. Design alignment (Luna BMS “Digital Curator”)

The [design system](designsystem.md) favors **tonal surfaces**, **Manrope/Inter**, **teal primary** (`#00333f`), and **no harsh 1px dividers**. The revamp should:

- Use **tokens** from `theme/tokens` — not the reference’s pure black pills; use **`surface-container-lowest` cards**, **`primary` / `secondary_container` chips**, **editorial typography** for deal value.
- Prefer **spacing** and **soft elevation** over borders between cards (per “Divider Ban”).
- Treat **UGX** and **short dates** as the hero numbers on cards.

---

## 5. Data model (minimal vs optional)

**Already sufficient for “list revamp v1”**

- `opportunities`: `name`, `status`, `estimated_value` / `value`, `client_id`, `captured_at`, `contact_*`, `location`.

**Optional follow-ups (document in tickets when scoped)**

| Idea | Purpose |
|------|---------|
| `win_probability` or `score` (0–100) | Match “confidence %” in reference A — **nullable** until product decides. |
| `last_activity_at` | “Last activity” line — could default to `updated_at` or max(quotation, post) timestamps. |
| Client logo / avatar | Requires **client** image field + picker — later. |

**Stage changes**

- Today status is a **string** from `OPPORTUNITY_PIPELINE_STATUSES`. Kanban “move card” = **`opportunities.update`** with `{ status }` + LWW `expectedUpdatedAt` — **no migration** if labels stay the same.

---

## 6. Proposed phases (revamp roadmap)

### Phase P1 — Pipeline list (mobile-first, all platforms) — **shipped**

**Goal:** Match reference A’s **information density** without new backend fields.

1. Replace `EntityList` string rows with a **custom FlatList** of **PipelineOpportunityCard** components:
   - **Title**: opportunity name (Manrope `bodySemi`).
   - **Subtitle**: linked **client name** from `client_id` (or “No client”).
   - **Meta row**: `captured_at` or relative **“N days ago”** (from `captured_at` / `updated_at`).
   - **Footer**: **stage chip** (mapped from `status`) + **UGX value** (right-aligned, bold).
   - **Optional**: contact row with **phone/email** icons when `contact_phone` / `contact_email` present.
   - **Chevron** or tap target = navigate to `pipeline/[id]`.
2. **Search** — Filter list by `name`, client name, contact fields (client-side `useMemo`).
3. **Filter chips** — `All` + one chip per `OPPORTUNITY_PIPELINE_STATUSES`; horizontal `ScrollView`, same pattern as Finance chips.
4. **Empty / error** — Keep illustration + CTA; add **“no matches”** state when search/filter returns nothing.

**Files**  
`apps/fieldops/app/(drawer)/(tabs)/pipeline/index.js`, `apps/fieldops/components/PipelineOpportunityCard.js` (filtering inlined with `useMemo`).

---

### Phase P2 — Responsive layout polish (tablet / web width)

**Goal:** Use horizontal space without forcing Kanban yet.

1. At **breakpoint ≥ 900px** (or reuse drawer breakpoint from [designsystem.md](designsystem.md)): optional **two-column** list or **wider cards** with more metadata visible.
2. **Sticky** filter chip row or compact search under app header.

---

### Phase P3 — Kanban board (web-first, then native)

**Goal:** Reference B-style **columns by stage**.

1. **Web**: Implement Kanban with **CSS columns** + **@dnd-kit** or **react-native-web**-compatible DnD; each column = `status` filter; card = same as P1 card (compact).
2. **Drag end** → `repos.opportunities.update(id, { status: newStage }, { expectedUpdatedAt })` — handle **LWW conflict** with toast/retry.
3. **Mobile narrow**: **toggle** “List | Board” only if board is usable; otherwise **list-only** on phone, Kanban on `minWidth` media query.

**Risk:** Effort; schedule **after** P1 ships and is validated.

---

### Phase P4 — Power features (optional)

- **Probability / score** column + filter “high confidence only”.
- **Bulk select** + batch status (needs UX + conflict rules).
- **Column analytics** — count + **sum(estimated_value)** per stage (like reference **TOTAL**).
- **Rejections** — only if we model **lost** opportunities explicitly (today `status` may include “Closing” but not “Lost” — product decision).

---

## 7. Success criteria

- **P1**: User can **find** an opportunity in **&lt; 10s** with search + stage chip; list reads as **cards**, not log lines.
- **P2**: Wide layout feels **intentional**, not a stretched phone UI.
- **P3**: Owner can **re-stage** opportunities by drag on web without corrupting data (LWW respected).
- **Visual**: All new UI uses **tokens** and passes **accessibility** (tap targets, label for chips).

---

## 8. Open questions (product / eng)

1. **Stage naming** — Keep `Prospecting → Closing` or align to simpler labels (closer to reference A) with a one-time data migration?
2. **“Probability”** — Ship without until Phase P4, or add a **slider** on edit screen only?
3. **Kanban priority** — Is **P3** required for pilot, or is **P1 list** enough for v1?
4. **Server sync** — When PostgreSQL sync lands, stage updates from Kanban must respect **sync queue** / conflict policy — note in sync design doc.

---

## 9. Appendix — Reference screenshots

Reference captures used for this review were supplied alongside the task (mobile lead list + Kanban ATS-style board). **Version them in-repo** under e.g. `docs/reference/pipeline/` if the team wants them in PRs; otherwise keep them in your design handoff folder.

---

*Document version: 1.0 — aligns with Milestones through M12; pipeline data model as of SQLite v9.*

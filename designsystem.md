# Design System Document

## 1. Overview & Creative North Star: "The Digital Curator"

In the world of high-stakes finance, noise is the enemy. This design system is built upon the "Digital Curator" philosophy—an editorial-first approach that treats financial data not as a spreadsheet, but as a premium publication. We move away from the "industrial" look of traditional dashboards (crowded grids, heavy borders, and monotonous grays) in favor of an expansive, atmospheric experience.

The visual signature is defined by **intentional asymmetry** and **tonal depth**. By utilizing high-contrast typography scales and overlapping surface layers, we create a layout that breathes. The dashboard shouldn't feel like a tool you use; it should feel like a space you inhabit. We prioritize the "Human Core"—making complex numbers feel approachable through generous whitespace (using our `16` and `20` spacing tokens) and a sophisticated palette of deep teals and cool, airy blues.

---

## 2. Colors & Surface Philosophy

The palette is rooted in professional authority (`primary: #00333f`) balanced by a celestial, breathable background (`background: #f8f9ff`).

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for defining sections. Borders are "design debt." Instead, define boundaries using:
*   **Background Shifts:** Use `surface-container-low` (#eff4ff) to define a sidebar against a `surface` (#f8f9ff) main stage.
*   **Negative Space:** Use the Spacing Scale (minimum `8` or `2.75rem`) to create psychological breaks between data clusters.

### Surface Hierarchy & Nesting
Think of the UI as physical layers of fine paper. 
*   **Base:** `surface` (#f8f9ff).
*   **Level 1 (Sectioning):** `surface-container-low` (#eff4ff).
*   **Level 2 (Active Cards):** `surface-container-lowest` (#ffffff) to provide a "pop" of clarity.
*   **Level 3 (Interactions/Modals):** `surface-container-highest` (#d6e3fb).

### The "Glass & Gradient" Rule
To elevate the experience, use Glassmorphism for floating navigation or header elements. Apply `surface_variant` (#d6e3fb) at 60% opacity with a `20px` backdrop-blur. For primary CTAs, use a subtle linear gradient from `primary` (#00333f) to `primary_container` (#0e4b5a) at a 135-degree angle to add a "soulful" depth that flat color cannot provide.

---

## 3. Typography: The Editorial Voice

We use a dual-font strategy to balance character with legibility.

*   **Display & Headlines (Manrope):** The Manrope face is used for all high-level data storytelling. It is modern, geometric, and authoritative. Use `display-lg` (3.5rem) for total portfolio values to create a clear focal point.
*   **Body & Labels (Inter):** Inter handles the "work" of the dashboard. Its high x-height ensures that complex financial strings and small labels remain crisp.
*   **Hierarchy as Brand:** By setting `label-sm` in `on_secondary_variant` (#40484b) and `headline-md` in `on_background` (#0f1c2d), we create a rhythmic reading experience that guides the user's eye from the "Big Picture" to the "Fine Print" without cognitive load.

---

## 4. Elevation & Depth: Tonal Layering

Shadows and lines are replaced by the **Layering Principle**. 

*   **Ambient Shadows:** For floating elements (like an active FAB or a dropdown), use an extra-diffused shadow. 
    *   *Spec:* `0px 20px 40px rgba(15, 28, 45, 0.06)`. The color is a low-opacity version of `on_surface` to mimic natural light.
*   **The Ghost Border:** If accessibility requires a stroke (e.g., in high-contrast mode), use `outline_variant` (#c0c8cb) at 20% opacity. Never use 100% opaque outlines.
*   **Depth via Blur:** Use backdrop-blurs on secondary navigation rails to allow the teal and blue tones of the dashboard to bleed through, making the sidebar feel like part of the environment rather than a separate "tray."

---

## 5. Components

### Buttons & Chips
*   **Primary Button:** Gradient of `primary` to `primary_container`. Corner radius `md` (0.375rem). Use `title-sm` for button text to maintain a professional weight.
*   **Chips:** Use `secondary_container` (#cfe3eb) with `on_secondary_container` (#53666c) text. Use the `full` (9999px) radius scale for chips to contrast against the `md` radius of cards.

### Input Fields
*   **Styling:** No bottom line. Use a `surface-container-highest` (#d6e3fb) fill with a `sm` (0.125rem) radius. 
*   **States:** Focus state uses a `2px` "Ghost Border" of `primary` (#00333f) at 40% opacity.

### Cards & Lists
*   **The Divider Ban:** Strictly forbid `<hr>` lines. Separate list items using `1.5` (0.5rem) of vertical whitespace. 
*   **Interactive Cards:** Instead of a hover shadow, use a hover background shift from `surface-container-lowest` to `surface-bright`.

### Additional Component: The "Perspective Insight" Card
A specialized component for financial trends. Uses a `tertiary_container` (#613c13) background with `on_tertiary_fixed` (#2d1600) text for high-priority alerts or market shifts, creating a sophisticated "Gold/Deep Bronze" accent that denotes premium value.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. A 60/40 or 70/30 split creates more visual interest than a symmetric 50/50 grid.
*   **Do** use `title-lg` for card titles, but pair it with a `label-md` in uppercase for "Category" tags to create an editorial feel.
*   **Do** prioritize `primary_fixed` (#b6ebfd) for highlights in data visualizations (charts/graphs) to contrast against the dark teal.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_background` (#0f1c2d) to keep the "Teal" soul of the system alive.
*   **Don't** use standard `1px` borders for tables. Use alternating row fills of `surface` and `surface-container-low`.
*   **Don't** crowd the edges. If an element is within `3` (1rem) of the screen edge, it’s too close. Use the `6` (2rem) spacing token as your standard "safe zone" margin.

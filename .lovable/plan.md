
# myproduct-hub — Personal Tools Landing Page

A minimal, clean white + light-maroon landing page for **myproduct.life**, introducing Tirath Chhatriwala and showcasing his suite of PM tools.

## Design direction
- **Palette:** White background, deep charcoal text, light-maroon (`~#9B3B47` / oklch warm) as the single accent for links, hover states, and tile borders.
- **Type:** System sans, generous line-height. Large, calm headings. Stripe/Linear-style restraint.
- **Layout:** Centered max-width container (~1100px), heavy whitespace, subtle dividers. Fully responsive (single column on mobile, 2–3 col grids on desktop).

## Routes (TanStack Start, file-based)
Single-page landing — all sections live on `/` since they're tightly connected and short. Each gets its own anchor for in-page nav.

- `src/routes/index.tsx` — full landing page with sections below
- `src/routes/__root.tsx` — site shell, header nav, shared meta
- Update `head()` with title "Tirath Chhatriwala — myproduct.life", description, og tags

## Page sections

### 1. Header (sticky, minimal)
- Left: `myproduct.life` wordmark (maroon dot accent)
- Right: anchor links — Tools · Strategy · Writing · Contact

### 2. Hero
- Eyebrow: "Product Manager · 14+ years"
- H1: "Hi, I'm Tirath Chhatriwala."
- Sub: "I build products and tools at the intersection of EdTech, regulatory compliance, and higher education. **myproduct.life** is where my side projects, notes, and writing live."
- Two subtle CTAs: "Explore my tools" (scrolls to grid) · "Get in touch" (scrolls to footer)

### 3. My Tools grid
3-column responsive grid of tile cards with hover lift + maroon border:
- **Project SOR** — live tile, brief one-liner, links to `https://sor.myproduct.life` (opens new tab, external icon)
- **5× greyed "Coming soon" tiles** — muted background, lock/clock icon, no hover state, non-clickable

### 4. My Strategy (empty state)
- Section heading + short intro line
- Bordered placeholder card: *"Coming soon — frameworks, teardowns, and strategy notes from 14 years of PM work will live here."*

### 5. My Writing (empty state)
- Section heading + short intro line
- Bordered placeholder card: *"Coming soon — essays on product, EdTech, and regulatory complexity."*

### 6. Footer
- Left: small bio line + copyright
- Right: GitHub · LinkedIn · Email icon links (using lucide icons), maroon hover
- *(Will use placeholder `#` hrefs until you share the actual URLs)*

## Technical notes
- Tailwind v4 theme tokens: introduce `--accent` and `--accent-foreground` mapped to light-maroon in `src/styles.css`
- Smooth scroll behavior for anchor nav
- All content authored as real text (no Lorem) so the page ships ready
- SEO: descriptive `<title>`, meta description, og:title/description in root route head()

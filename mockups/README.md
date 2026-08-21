# Fync — "Campus Press" UI direction

Mockups for the `client/` app. Open **`index.html`** for the board, **`00-system.html`** for tokens and components.
Everything is static HTML/CSS, no build, no network beyond one Google Fonts link.

```
mockups/
  index.html          board — all 49 screens in phone frames, grouped by feature family
  00-system.html      design system sheet: palette, type, the 6 signature devices, rules,
                      and the padding contract every screen is audited against
  css/tokens.css      the design tokens (maps 1:1 onto client/tailwind.config.js)
  css/ui.css          component kit + 85-icon CSS-mask set
  screens/01..10      the app shell: home, explore, shorts, profile, chat, notifications, auth
  screens/11..49      one screen per service in constants/features.ts
```

**Coverage.** All 43 entries in `constants/features.ts` have a screen. Three of them
(`hackathons`, `placement`, `nightClub`) and `collegeChat` live in the 01–10 range because
they were built first; the rest run 11–49 in category order — study, career, events,
social, campus, fun, account.

---

## 1. The direction, and why this one

**Audience:** 18–24 Indian college students, plus alumni and recruiters looking at the same content.
**The app:** 47 features across study, career, events, social, campus and fun — a super-app, not a single-purpose product.

The visual world is the **college notice board**: xeroxed fest posters, stamped forms, stickers taped on at an angle, hand-ruled section headers, and a big number written in marker. It is a world this audience already lives in, and no template ships with it.

Concretely that means:

| | |
|---|---|
| **Ink on warm paper** | `#12100E` on `#F5F2EC`, not slate-900 on `#F8FAFC`. The single highest-leverage change — same layouts read completely differently at a different colour temperature. Cool grey is the default look; warm paper is a choice. |
| **One loud accent** | Orange stays. It is already the app icon, splash, notification tint and the most-used colour in the codebase. Everything else earns its colour semantically (audience role, feature family). |
| **Hard edges, one stamp** | Exactly one card per screen gets `4px 4px 0` offset shadow — the action that screen exists for. Everything else is a 1px hairline. Hierarchy from scarcity, not from more shadow. |
| **Numbers are the product** | Streak, Fync score, rank, seats left, countdown, ₹ paid. Grotesk tabular numerals in a dashed stamp. These are the things students screenshot. |
| **Two surfaces, not one** | Paper for the day-app; a warm dark + violet **night surface** for Shorts, 12 AM Club and calls. A second theme, not an inversion. |
| **One gutter, no exceptions** | 20px, and the *glyph* meets it — not the touch box. Every screen is checked by a headless pass for clipped elements, sub-44px tap targets and gutter breaks. See §5. |

**Type:** Space Grotesk 700 for display, headings and all numerals; Inter for body. Grotesk's slightly mechanical letterforms are what stop the app reading as another Inter-only product.

### The six signature devices

These are what make a cropped screenshot recognisable as Fync. Full specs in `00-system.html`.

1. **Section rule** — eyebrow, 2px hard rule to the edge, tabular count on the right.
2. **Sticker chip** — 2px border, 2px hard shadow, rotated ~1.6°. Status and identity only, never navigation.
3. **Stamp shadow** — one card per screen.
4. **Number stamp** — dashed circle, tabular numerals.
5. **Ticker** — ink strip under the status bar on Home. Campus is live; say so before the user scrolls.
6. **Cut corner** — 18px notch on secondary feature cards, a quiet repeat that ties unrelated screens together.

---

## 2. What this changes in the shipped app

Five things, in order of impact:

1. **Surface temperature.** `#F8FAFC` → `#F5F2EC`, slate text → warm ink. One token edit, whole-app effect.
2. **Uppercase discipline.** The app currently sets body copy, hints, author names and card titles in `uppercase font-black` at 11–12px. Uppercase becomes a **label-only** treatment; content moves to sentence case at 15px. This is the app's biggest legibility cost today.
3. **Orange used as text.** `#F97316` on white is 3.0:1 — it fails AA for body-size text and it is used that way in several screens. `#EA580C` (4.6:1) becomes the text variant; `#F97316` is for fills.
4. **Role becomes visible.** Student / alumni / recruiter get an avatar ring **plus** a text sticker — never colour alone. `Avatar.tsx` already rings by role; this formalises it and pairs it with text.
5. **Shadow budget.** The shipped screens mix `shadow-sm`, `shadow-xl`, coloured shadows and elevation on the same surface. Two levels only: hairline, and one stamp per screen.

---

## 3. Porting to NativeWind

### 3.1 `client/tailwind.config.js`

Keep the existing `brand` ramp exactly as it is. Add:

```js
colors: {
  brand,                       // unchanged
  ink:   { DEFAULT:'#12100E', 2:'#57534E', 3:'#8B857E', 4:'#C4BEB6' },
  paper: { DEFAULT:'#F5F2EC', 2:'#EDE8E0' },
  line:  '#E3DDD3',
  accent: brand[500],
  'accent-text': brand[600],   // the 4.5:1-safe one — use for ALL orange text
  alumni: '#B45309', recruiter: '#4F46E5',   // replaces #ffd700 / #6366f1
  night: { DEFAULT:'#0D0B12', 2:'#171320', ink:'#EDE8E0', 3:'#8B8397' },
  violet: '#A78BFA',
  fam: { study:'#7C3AED', career:'#2563EB', events:'#EA580C',
         social:'#0891B2', campus:'#57534E', fun:'#DB2777' },
},
fontFamily: {
  display: ['SpaceGrotesk_700Bold'],
  sans:    ['Inter_400Regular'],
  medium:  ['Inter_500Medium'],
  semibold:['Inter_600SemiBold'],
},
```

`constants/features.ts` already carries a `tint` per feature — point those at the `fam.*` values so a category reads as one colour instead of forty.

### 3.2 Fonts

`expo-font` is already a dependency and `expo-font` is in the plugin list. Add the two families and load them in `App.tsx` before hiding the splash. Both are SIL Open Font Licence.

### 3.3 New components — `client/components/ui/`

The kit is small on purpose. Six files:

| Mockup class | Component | Notes |
|---|---|---|
| `.rule` | `SectionRule` | `label`, optional `count`. Replaces every ad-hoc section header. |
| `.sticker` | `Sticker` | `tone` = brand / alt / live / gold / recruiter, `tilt` bool. |
| `.stampnum` | `StampNumber` | `value`, `caption`. Streaks, ranks, timers. |
| `.card` / `.card.stamp` | `Card` | `stamp` bool — lint rule: one per screen. |
| `.btn` | `Button` | `variant` = primary / solid / quiet / ghost, min height 48. |
| `.ticker` | `Ticker` | Home only. Reuse `react-native-reanimated`, already installed. |

`.chip`, `.tile`, `.av`, `.tabs` map onto what `ExploreHub.tsx`, `Avatar.tsx` and `home-screen.tsx` already render — restyle in place rather than adding components.

Two more that earn their own file because the padding contract depends on them:

| Mockup class | Component | Notes |
|---|---|---|
| `.bottombar` | `DockedBar` | Pinned action bar for pushed screens. Pads `20 + 10` at the bottom so it clears the home indicator; replaces the floating tab bar rather than stacking on it. |
| `.chip.tag` / `.tagrow` | `Tag`, `TagRow` | Read-only metadata. Wraps instead of scrolling — a horizontal scroller nested in a vertical list fights the scroll gesture. |

Icons stay `@expo/vector-icons` Ionicons **outline** set at one size scale (16 / 22 / 28). The mockups use a matching 1.9px-stroke set purely so the HTML needs no icon dependency.

### 3.4 Suggested order

1. Tokens + fonts (`tailwind.config.js`, `App.tsx`, `app.json` splash/background `#F5F2EC`).
2. `TabLayout.tsx` — bar is already the right shape; only colours change.
3. `home-screen.tsx` — ticker, stamped "Campus now" card, sentence-case feed.
4. `ExploreHub.tsx` — section rules, family colours. Smallest diff, biggest visible win.
5. `profile.tsx` — Fync score stamp.
6. Night surface: `Shorts.tsx`, 12 AM Club, `videoCall/`, `audioCall/`.
7. Everything else inherits the tokens.

---

## 4. Non-negotiables

Carried from Apple HIG / Material / WCAG 2.2 AA, and checked in every mockup:

- Text contrast ≥ 4.5:1 both themes. Orange text = `#EA580C`, never `#F97316`.
- Tap targets ≥ 44×44 — including the feed vote arrows and app-bar icons.
- Colour is never the only signal: role ring always pairs with a text sticker.
- Body text ≥ 15px; the 11px floor applies to labels only.
- Scroll content clears the floating tab bar — `useTabBarClearance()` already exists in `constants/layout.ts`, use it.
- Sticker rotation is decorative: it must not clip text or reduce the tap area.
- Night surface is a designed theme, not an inverted light theme; contrast is verified separately.

---

## 5. The padding contract

Section 07 of `00-system.html` carries the full table. These are the rules, and each one
exists because it was a real defect in the first cut of these mockups — found by measuring,
not by looking:

1. **One gutter: 20px.** Status bar, app bar, tabs, section rules and cards all start on the
   same line. The status bar was at 22px and read as a wobble.
2. **`.pad-in` is 16px and works standalone.** It used to apply only as `.card.pad-in`, so a
   card body under a media block got no padding at all — which is what clipped every number
   stamp against the card edge.
3. **Edge icon buttons overhang by 11px.** A 44px touch box aligned at 20px puts its glyph at
   31px. The glyph meets the gutter; the box hangs off it.
4. **A tile's box fills its column.** A 54px box centred in an 87px column sat 17px inside the
   gutter, so the Explore grid never lined up with the rule above it.
5. **Nothing with a hard shadow or a rotation sits flush against a clipping edge.** `.card` is
   `overflow:hidden` for its media, so a stamped button or a rotated sticker at the padding
   edge gets sliced.
6. **Scrollers bleed to the edge of the box that holds them** — and inside a card, metadata
   does not scroll at all. Use `.tagrow` + `.chip.tag`.
7. **`.row` never strips a card's own padding.** A card that *is* a row keeps `.pad-in`.
8. **Docked bottom bars clear the home indicator** (`20 + 10`).
9. **Number-stamp captions fit inside the ring** — 66px ring, caption capped at 56px.
10. **44px is a floor, not a target.** `.chip` and `.btn.sm` were 32–38px; both now meet it.
    Genuinely non-interactive metadata uses `.chip.tag` at 28px, where the floor does not apply.

### Checking it

The audit is a headless Chrome pass that walks every element, compares its visual box —
including hard offset shadows — against the padding box of its nearest clipping ancestor,
and flags anything clipped, any tap target under 44px, and any gutter break. All 49 screens
pass. Port the same three assertions to the RN side and they hold there too, since the
mockup classes map 1:1 onto the components in §3.3.

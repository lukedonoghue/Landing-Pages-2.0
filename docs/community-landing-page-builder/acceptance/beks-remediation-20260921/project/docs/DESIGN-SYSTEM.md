# Design System

## Brand evidence

The official site render uses Lora and a burgundy-led palette. The implemented page self-hosts Lora, keeps the burgundy recognition, and introduces muted teal as an information cue. Measured source evidence is in `build/brand.json`.

## Color

| Token | Value | Use |
|---|---|---|
| Burgundy | `#5F0B35` | Primary actions and brand accents |
| Burgundy dark | `#400723` | Display headings and deep bands |
| Teal | `#2F675D` | Clarity cues, steps, and supporting emphasis |
| Mint | `#DCECE7` | Demo notice and guide band |
| Pale pink | `#F5E8EE` | Secondary emphasis |
| Paper | `#FBF8FA` | Main background |
| Ink | `#211A1E` | Primary text |
| Line | `#D8C6CF` | Dividers and controls |
| Focus gold | `#D69A24` | Visible keyboard focus |

## Typography

- Display, body, and UI: self-hosted Lora variable font, weights 400-700, with Georgia/serif fallbacks. The source file and SIL OFL 1.1 license are from Google Fonts; hashes and conversion details are recorded in `public/assets/fonts/lora/provenance.json`.
- No third-party font request is made at runtime.
- Letter spacing is zero for headings; compact uppercase eyebrows are limited to labels.
- Hero display sizing uses bounded desktop `clamp()` values and fixed mobile sizes without viewport-width units; controls use stable fixed minimum heights.

## Imagery

- Photorealistic editorial illustrations, warm daylight, burgundy and muted-teal accents.
- Images are supporting context, never proof; every generated image has nearby disclosure text.
- The cleanup illustration uses a stable 4:3 frame with automatic responsive height; its context remains intentionally illustrative rather than proof.
- The information-bearing guide cover uses its intrinsic portrait ratio with automatic height and no letterboxing frame.

## Components

- 5-7px radii, fine rules, flat page bands, and restrained modal/guide shadows.
- Primary burgundy buttons, text links for secondary navigation, native details/summary FAQ controls.
- Full-bleed hero, compact proof band, alternating unframed sections, two-step modal form.
- WCAG-oriented skip link, labeled controls, visible focus, live form status, reduced-motion support, and 48px primary targets.

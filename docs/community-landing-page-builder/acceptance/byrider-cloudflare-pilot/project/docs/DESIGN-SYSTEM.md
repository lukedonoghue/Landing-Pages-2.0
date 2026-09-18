# Design System

## Direction: Operator Blueprint

The design should feel like a serious investment brief brought to life: precise, confident, contemporary, and more editorial than the current Byrider sites. It uses Clean Slate's persuasive depth and alternating media rhythm without copying its dark contractor aesthetic or panel geometry.

## Brand tokens

- Ink: `#10243E` - primary copy and dark surfaces.
- Byrider blue: `#215EAC` - core brand action and identity.
- Deep blue: `#102A49` - hero and high-contrast section background.
- Signal orange: `#FF8200` - sparing action accent and route markers.
- Paper: `#F7FAFF` - clean, cool page surface.
- White: `#FFFFFF` - cards and high-contrast type.
- Slate: `#4A6077` - supporting copy.
- Rule: `#D9E4EF` - quiet borders.

Official Byrider blue anchors the page. Orange is limited to directional cues and active controls. Clean white and cool light-blue surfaces keep the brand current without changing its identity.

## Typography

Use Byrider's verified production fonts, self-hosted from `public/assets/fonts`: `Montserrat` for headings, navigation, and primary actions; `Open Sans` for body copy, labels, and form controls. Typography uses zero letter spacing. Body copy remains 17-19px with a 1.6 line height and a 68ch maximum.

## Shape and layout

- 14–22px radii, not pills everywhere.
- 1px cool-gray borders and restrained shadows.
- Hero: asymmetric 7/5 split with copy on deep ink and an official dealership image layered behind a floating guide-preview card.
- Section rhythm alternates full-width paper, white, and ink panels; media changes sides to maintain cadence.
- Mechanism uses an original three-node route diagram built in HTML/CSS, supported by first-party imagery.
- Proof blocks remain photographic and clearly attributed.
- CTA buttons are rectangular with a clipped arrow detail, echoing the logo mark without redrawing it.

## Motion

Use subtle opacity/translate reveals (12–18px, 360–520ms) and gentle media parallax only when motion is not reduced. No autoplay video, carousels, counters, or animation that delays access to the form.

## Accessibility and responsive behavior

All text-on-color combinations meet WCAG AA. Focus uses a 3px orange outline plus 2px offset. Motion is removed under `prefers-reduced-motion`. Touch targets are at least 44px. The modal uses a visible title, fieldsets, legends, a live step counter, inline errors, focus trap, Escape/backdrop close, and focus restoration.

At 1024px the hero remains split but compresses type. At 768px media and copy stack with the action before decorative detail. At 390/360px the header keeps the logo, phone, and CTA readable; the hero image becomes a 4:5 crop with dealership signage preserved. The form becomes a full-height sheet with a scrolling body and fixed action row.

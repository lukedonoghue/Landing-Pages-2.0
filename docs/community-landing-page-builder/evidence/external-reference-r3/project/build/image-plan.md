# Image plan

All five photographs and the logo are from The Garden Room Co.'s public website, retrieved 2026-09-20. The pages identify these as its work. Their presence online is not a licence grant; this build is a local preview only until the business confirms publication rights. Original downloads are retained under `build/source-assets/`. Optimised WebP assets and smaller mobile candidates are under `assets/`.

| Placement and role | Source | Readable pixels | Treatment and alt | Local asset |
| --- | --- | --- | --- | --- |
| Header logo, proof of identity | https://gardenroomco.com/wp-content/uploads/2021/09/garden_room_co_logo.png | Logo lettering must remain legible | Native aspect ratio on charcoal; alt "The Garden Room Co." | `assets/logo.png` |
| Hero, proof of completed room | https://gardenroomco.com/wp-content/uploads/2023/06/garden-rooms-north-wales.jpg | Room and glazing must be visible | Wide photo above an unframed text band on desktop and mobile; no copy covers the room; alt describes cedar-clad room and folding doors | `assets/hero.webp` |
| Design section, proof of room with covered outdoor area | https://gardenroomco.com/wp-content/uploads/2022/06/Garden-Room-Co-North-Wales-SIPS-Garden-Room-12.jpg | Room and canopy must be visible | Unobscured figure, `object-fit: cover` with reviewed crop; factual alt | `assets/office.webp` |
| Walthamstow project, proof | https://gardenroomco.com/wp-content/uploads/2023/05/Garden-Room-Co-Walthamstow-SIPS-Garden-Room-shou-sugi-ban-13.jpg | Facade and open doors must be visible | Portfolio image; project page linked; factual alt | `assets/walthamstow.webp` |
| Dyserth project, proof | https://gardenroomco.com/wp-content/uploads/2022/05/Garden-Room-Co-North-Wales-SIPS-Garden-Room-14.jpg | Building and glazing must be visible | Portfolio image; project page linked; factual alt | `assets/dyserth.webp` |
| Moreton project, proof | https://gardenroomco.com/wp-content/uploads/2021/12/Garden-Room-Co-North-Wales-SIPS-Garden-Room-6.jpg | Facade must be visible | Portfolio image; project page linked; factual alt | `assets/moreton.webp` |

No generated imagery or synthetic proof is used. Review captures and asset-specific observations are recorded in `build/acceptance.md` after implementation.

Responsive candidates: `hero-800.webp`, `office-640.webp`, `walthamstow-600.webp`, `dyserth-600.webp`, and `moreton-600.webp` are smaller encodes of the same first-party originals, selected through `srcset`.

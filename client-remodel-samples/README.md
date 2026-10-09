# Premium remodeling proposal samples
Two neutral concepts: `/atelier` and `/nova`.

- Matched AI-generated kitchen and bathroom before/after comparisons.
- Local Three.js 3D kitchen studio; SVG rendering fallback when WebGL is unavailable.
- Material and daylight controls, blueprint view, keyboard rotation.
- Original Lottie geometric drawing animation, scroll reveals, pointer depth, reduced-motion support.
- Interactive preset project planner and downloadable text briefs.
- Server-side live AI endpoint ready for OPENAI_API_KEY; clearly labelled demo mode without it.

Run `npm start`. No package installation is required. Node 20+.

Render free web service: build command `node --check client-remodel-samples/server.mjs`; start command `node client-remodel-samples/server.mjs`. Isolated proposal branch; no production branch changes.

Optional environment: OPENAI_API_KEY and OPENAI_MODEL. Never put a key in public files. Live calls can incur provider usage charges; activation requires owner authorization.

All photos are concept imagery, not completed work or business evidence. Brand names are temporary.


## Atelier multi-page rebuild

Atelier now has 17 content pages plus a branded 404: home, project collection and three stories, services and three detail pages, material edit, about, journal and three guides, project enquiry and preview privacy notice. `/nova` retains the alternate direction.

Atelier uses a photography-led material mood studio, not the previous schematic 3D viewer. Mood selections carry into the project brief. Kitchen and bathroom before/after sliders support keyboard input. The three-step brief validates input, saves a local draft, previews local reference photos, and downloads a real text brief. No lead is delivered. The design companion uses clearly identified preset guidance until OPENAI_API_KEY is configured. Never reuse keys from unrelated services.

The whole-home photograph is an AI-created editorial design study: warm limestone, timber and linen living room with a planted courtyard. Fonts: locally served Cormorant Garamond under SIL OFL; license in public/fonts.

Client launch requires approved branding, real business/team/service-area details, verified projects/reviews, a configured enquiry recipient/CRM and appropriate final privacy content. The preview must not claim fictional credentials or delivered enquiries.

Run `npm start` (PORT supported). Syntax check: `npm run check`. No runtime dependencies.

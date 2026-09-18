# Image sourcing, generation and rendered review

Run this stage after the user approves copy and while composing the design. Use the approved section copy to identify images that clarify the service, explain the process, support genuine proof, or create useful visual hierarchy. A client URL is enough to begin. Reference-page imagery establishes a compositional pattern; it is not automatically licensed for reuse or evidence about the client.

## Durable image plan

Adapt `assets/image-plan.example.json` for the actual sections. Initialize it at the **project root**, outside `public/`, using the helper:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" init --spec "$PROJECT/research/image-plan-draft.json"
```

`SKILL` means the installed or repository skill directory. `PROJECT` means this client's generated project. Paths in the manifest are relative to that project. The helper uses Python 3.10+ and the existing `optimize_images.py`/`cwebp` for WebP creation. It does not install packages, call a paid image API, or require API keys. Keep the three helper files together when copying the workflow into a generated project: `image_workflow.py`, `optimize_images.py`, and the example manifest.

For every placement, record:

- section, persuasive purpose and visual role;
- `client-proof`, `illustrative`, or `decorative` trust class;
- whether that image is required, and whether generation is allowed;
- desktop/mobile aspect ratios and focal points (normalized x/y coordinates from zero to one);
- factual alt text, or empty alt for purely decorative assets;
- separate desktop/mobile byte budgets;
- approved source rights, source URL or supplied-file evidence, source hashes and dimensions;
- requested/actual generation model, disclosure and tool evidence where applicable;
- exact optimized variants and the rendered review evidence.

A proof image means a real project, result, before/after pair, employee, customer, testimonial, certificate, or product whose appearance is itself part of the claim. It **must be actual client evidence**. Missing required proof blocks that placement; generate a different illustrative role only if it does not imply the missing proof and is consistent with approved copy. Do not invent a client project or employee using a lookalike photo. If appropriate, remove an optional image and document `omitted_reason`. Do not set a required image to optional just to make the gate pass. If no raster imagery serves the design, use an empty assets list with a specific `no_images_reason`.

Stages are `planned → acquired → optimized → reviewed`. Generated images first move through `generation-pending`, then either `acquired` or `generation-failed`. Prompt drafting is not generation completion. File presence is not rendered review. The manifest keeps timestamps and an append-only event list; each CLI operation takes a file lock, and manifest writes are atomic.

## Inspect the client assets first

1. Inspect the client site in the browser and save the observed DOM/HTML in `research/`. Include lazy-loaded image attributes, `srcset`, asset URLs and the page where each asset occurs. Scrolling/rendering the client page is necessary when useful imagery appears only after interaction.
2. Save the supplied-file instruction or source/license evidence locally. Review whether the photo actually depicts the client work the copy claims. Public availability alone does not establish permission.
3. Create candidates from the observed markup or an actual supplied image:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" inventory-html --html "$PROJECT/research/client-rendered.html" --page-url https://client.example/services/ --origin client-website
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" inventory-file --file /absolute/path/to/supplied-photo.jpg --evidence "$PROJECT/research/client-asset-instruction.txt"
```

The HTML extractor recognizes `<img>` sources, normal raster `srcset` attributes, `<source>` variants and `og:image`. It does not invent paths or blindly crawl a domain. CSS background images or images exposed by other lazy-loading attributes require browser inspection and a recorded observed inventory entry using the same `source_url`, `observed_page`, `origin` and hashed evidence fields. Logo SVG files stay in the normal brand/vector workflow; do not treat executable markup as a downloadable raster.

4. Add the exact observed client/CDN hostnames to `allowed_hosts`. A new redirect host must be observed and justified, not automatically trusted.
5. Download or copy the chosen source, with a specific rights basis and proof evidence where needed:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" acquire --id hero-client-project --candidate source-EXACT_ID --rights client-authorized --rights-evidence "Client authorized website asset reuse in the build brief" --proof-evidence "The supplied project gallery identifies this photograph as the client's River Road job"
```

The download helper accepts only HTTPS with exact host allowlisting, verifies every redirect, rejects non-public DNS addresses, connects to the checked IP with TLS verification for the original hostname, enforces MIME/byte/size limits, and checks raster signatures/dimensions. It never executes downloaded content. Source originals are copied into `research/image-originals/` with content-addressed filenames and SHA-256 records. Existing files are not overwritten. Full decode happens during optimization; corrupt images must not advance to the rendered stage.

Inspect the acquired image using the image-view tool. Decide whether the subject survives the planned mobile crop. Prefer another actual client photo over heavy cropping that removes the service or its evidence. Use sourced images before generation when they serve the same purpose well.

## Generate only useful missing supporting imagery

The default is the native `image_gen` tool through the installed imagegen skill. Read that skill the first time generation is needed. It requires no separate API key. Make one native request per asset/variant and preserve the output as a raster image; do not substitute an SVG placeholder for a requested photograph or illustration.

Record a generation budget before starting. The example allows three generated assets, two attempts per asset and six attempts in total. These are request-count bounds, not a promise about monetary cost. Failed attempts count. If the budget is exhausted, keep a suitable existing asset only when `allow_source_fallback` permits it; otherwise report the blocked placement and request a decision. Do not silently switch models or keep retrying.

1. Write a concrete prompt in `research/image-prompts/<id>.txt`: asset purpose, actual service subject, visual style, palette, framing, desktop/mobile crop needs, text/no-text constraints and exclusions. Generated supporting imagery must not imply real client projects, staff, customers, testimonials, certifications or results.
2. Prepare and reserve one attempt:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" prepare-generation --id service-process-illustration --prompt-file "$PROJECT/research/image-prompts/service-process-illustration.txt"
```

`--dry-run` prints the tool request without reserving a request or changing the manifest. A real prepare command saves a pending attempt before returning. Its output includes an `attempt_id` and the exact native `arguments` object. For a brand-new image the supported payload contains only `prompt`; it never invents a `model` parameter.

3. Call `image_gen.imagegen` with that `arguments` object. In code-mode, use the native tool's supported long initial yield and return its generated image so it can be inspected. If editing a real source, inspect the local source first and follow the imagegen skill's editing mechanism; do not use a generation prompt to simulate edits to unseen files. Any edit that alters what a proof photo claims must be treated as illustrative, not authentic proof.
4. Inspect the result, save the actual tool-result metadata as a local text/JSON evidence file, and register the **actual returned local image**:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" register-generation --id service-process-illustration --attempt EXACT_ATTEMPT_ID --file /absolute/path/from/tool/result.png --tool-evidence "$PROJECT/research/image-tool-result.json"
```

Add `--actual-model gpt-image-2.5-sunburst` or `--actual-model gpt-image-2.5-flare` **only if that exact model is reported by the actual tool result**. The helper rejects a known model mismatch, keeps absent model information as `unverified`, and refuses missing output files. Never manufacture tool evidence. The acquired artifact is copied into the project before it is referenced by the page.

5. On failure, record what happened:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" generation-failed --id service-process-illustration --attempt EXACT_ATTEMPT_ID --reason "Actual tool error summary, with no secrets"
```

### Exact GPT Image 2.5 requirement

The requested models are `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare`; their identifiers were checked against [OpenAI's Sunburst documentation](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) and [Flare documentation](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare) on 2026-09-16. Recheck current documentation if model availability changes.

The native tool may not expose a model selector or identify the model used. A prompt mentioning “GPT Image 2.5” is not evidence that this model ran. By default the final image gate keeps an exact-model requirement unresolved if the model is unreported. Explain the actual limitation at the relevant approval checkpoint. If the user expressly accepts the native tool's unspecified model, set `allow_unverified_native_model: true` and record the user's instruction in `model_exception_evidence`; the actual model must still remain `null`/`unverified`.

If the user explicitly chooses a CLI/API route to require an exact model, use the imagegen skill's supported bundled CLI. Do not silently change to an older model, invent an API flag, modify the imagegen helper, or create a one-off SDK runner. The installed CLI was inspected and accepts exact `gpt-image-*` model strings using `--model`. Capability inspection is not a successful generation or proof of account access.

### Optional explicit bundled CLI preparation

Use this only after the user selects the CLI/API/model-control path. Set the image's configuration to:

```json
{
  "generation": {
    "mode": "bundled-cli",
    "requested_model": "gpt-image-2.5-sunburst",
    "authorization_evidence": "Actual user instruction selecting the exact-model CLI/API path, with its conversation or local evidence location",
    "allow_unverified_native_model": false,
    "allow_source_fallback": true
  }
}
```

Then prepare the request using the **existing official installed helper**, without copying or modifying it:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" prepare-generation --id service-process-illustration --prompt-file "$PROJECT/research/image-prompts/service-process-illustration.txt" --imagegen-cli /absolute/path/to/imagegen/scripts/image_gen.py
```

The preparation command **does not execute generation**. It returns a shell-independent `argv` list with `generate`, the exact `--model`, a controlled project-local `--prompt-file`, and a unique project-local `--out` path. It also records the official CLI hash. Neither API keys nor authorization headers appear in the arguments. `--dry-run` previews the plan without saving the pending attempt or writing its prompt/output files; do not try to execute that preview as a completed prepared request.

The agent may then run the returned command directly as the authorized imagegen CLI, using a properly quoted argument list. Only this explicitly chosen CLI execution needs `OPENAI_API_KEY` in the local environment and the official helper's dependencies. Never paste the key into chat, append it to command arguments, or put it in the project or deployed Cloudflare environment. If the key, supported model, account entitlement or network is unavailable, record the actual blocker; the helper must not fall back to native generation or another model automatically.

After the actual CLI call, save execution evidence that records the exact prepared argv, successful process result and the resulting file hash:

```json
{
  "mode": "bundled-cli",
  "argv": ["THE", "EXACT", "PREPARED", "ARGUMENT", "LIST"],
  "exit_code": 0,
  "dry_run": false,
  "api_call_completed": true,
  "requested_model": "gpt-image-2.5-sunburst",
  "output_sha256": "SHA256_OF_THE_REAL_OUTPUT_FILE",
  "reported_model": null
}
```

This is an evidence shape, not permission to invent a completed call. Preserve the actual command output separately where useful, without secrets. Register with the normal `register-generation` command, passing the reserved output path, attempt ID and that evidence file. It rejects dry runs, nonzero exit status, changed CLI/prompt files, a different argv/model, unrelated output files, and mismatched output hashes.

Successful CLI registration records `provider: openai-api`, `selected_model: <exact requested model>`, and `model_verification: selected-in-cli-request`. The provider's actual model field remains unknown unless the provider explicitly reports it. Do not relabel selected-request evidence as native model attestation. When an actual provider response reports the exact model, record `reported_model` truthfully; mismatched reported models are rejected. This selected-model route satisfies an exact API request requirement without pretending native model selection exists. The bundled API route is tested using offline command/evidence fixtures; live model access and billable generation must be verified when actually used.

Generation happens at build time. Only the optimized output images are published on Cloudflare. No OpenAI key, image tool credentials, prompt history, raw research or model access requirement belongs in the deployed public site.

## Optimize the selected real files

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" optimize --id hero-client-project
```

The command invokes the existing repository `optimize_images.py`. It creates WebP variants at 480, 960 and 1600 pixels capped at the original width, in a fresh directory per run. It hashes every variant and records actual dimensions and bytes; it does not upscale or overwrite previous variants. Install `cwebp` if unavailable and rerun rather than recording fictional optimized files.

Use the recorded variant paths in the rendered page. Include width and height, `srcset`/`sizes`, honest alt text, and CSS `object-position` matching the focal points. A focal point of `[0.65, 0.5]` means `object-position: 65% 50%`. Use the approved aspect ratio in each breakpoint. The hero/LCP image loads eagerly; below-fold imagery loads lazily. Serve a brochure cover image instead of rendering the entire PDF on the landing page. Keep generated disclosure in the handoff; add an on-page illustration label when the imagery could otherwise be mistaken for documentary proof.

## Review in the actual page, then enforce the gate

Inspect the original and final files, then view the complete rendered page at desktop and mobile sizes. Scroll to load lazy images and inspect the exact files delivered in the network panel. Check focal subject visibility, meaningful crop, skin/material/text artifacts, visual consistency, contrast behind overlaid copy, actual loaded file weight, and whether image plus caption/copy implies an unsupported claim. Test a narrow mobile width as well as desktop; do not reuse a desktop screenshot and label it mobile.

Save a report inside the project, with this shape (fill hashes and paths from the manifest; use actual screenshots and honest review results):

```json
{
  "reviewer": "ChatGPT visual review",
  "source_sha256": "EXACT_ORIGINAL_SHA256",
  "variant_sha256": {
    "public/assets/images/optimized/EXACT_VARIANT_480.webp": "EXACT_SHA256",
    "public/assets/images/optimized/EXACT_VARIANT_960.webp": "EXACT_SHA256",
    "public/assets/images/optimized/EXACT_VARIANT_1600.webp": "EXACT_SHA256"
  },
  "desktop": {
    "screenshot": "screenshots/image-review-desktop.png",
    "viewport": {"width": 1440, "height": 1000},
    "device_pixel_ratio": 1,
    "served_variant": "public/assets/images/optimized/EXACT_VARIANT_1600.webp",
    "subject_visible": true,
    "crop_appropriate": true,
    "alt_appropriate": true,
    "no_false_claim": true,
    "page_layout_checked": true
  },
  "mobile": {
    "screenshot": "screenshots/image-review-mobile.png",
    "viewport": {"width": 390, "height": 844},
    "device_pixel_ratio": 1,
    "served_variant": "public/assets/images/optimized/EXACT_VARIANT_480.webp",
    "subject_visible": true,
    "crop_appropriate": true,
    "alt_appropriate": true,
    "no_false_claim": true,
    "page_layout_checked": true
  }
}
```

Register each review and validate all planned imagery:

```bash
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" review --id hero-client-project --report "$PROJECT/build/hero-image-review.json"
python3 "$SKILL/scripts/image_workflow.py" --plan "$PROJECT/image-plan.json" validate
```

The final command exits nonzero for missing source files, changed hashes, absent provenance, unknown exact-model status, missing desktop/mobile rendered reviews, wrong viewport screenshots, oversized delivered variants, or unreviewed required placements. An optional asset must either pass review or have a specific omission reason. Replacing an image or reoptimizing it invalidates its old review. A passing image gate supplements the complete visual review and measured load-speed report; it does not prove page LCP or whole-page quality by itself.

Run offline regression checks with:

```bash
python3 -m unittest discover -s "$SKILL/tests" -p test_image_workflow.py
```

The tests exercise observed-source inventory, local acquisition, MIME/host/redirect limits, native request payload shape, explicit bundled CLI selection and safe argv, budget and failure handling, source/model honesty, real WebP optimization when `cwebp` is installed, and stale review detection. Mock image registrations in tests verify bookkeeping only; they do not claim a model actually generated those test fixtures. No external image CLI or API executes in these tests.

# Native image model gate contradiction

## Observed failure

The assisted Clarentis release stopped before any Cloudflare mutation because four genuinely generated and visually reviewed images had no tool-reported model identity. The default community image instructions explicitly allowed native generation without an exact model or API key, but the inherited executable guard, example plan and detailed reference still imposed an exact-model requirement. This was a source-contract contradiction, not a reason to fabricate metadata or ask a beginner for another approval.

## Correction

The native default now has a null/omitted requested model. Unknown actual identity remains null/unverified and is disclosed as a warning after the unchanged file, provenance, rights, responsive crop and rendered screenshot checks pass. Historical exact-model requests in generation settings, provenance or recorded attempts still block unverified completion unless the user really accepts that limitation. The explicit CLI path still requires its actual authorization and exact request; it is not silently selected.

The example and both image references now agree with the executable helper. The generated Clarentis project receives this as an explicitly recorded assisted recovery change; its original frozen skill is not rewritten and the first run is not relabelled as an unaided success.

## Verification

42 image-workflow tests passed, including real cwebp optimization, native default registration and rendered review, preserving an unknown actual model, exact-model refusal, stale evidence and crop/byte-budget checks. No image was regenerated merely to obtain unavailable metadata. The final deployment must still pass current source-bound gates; this correction alone is not a live release.

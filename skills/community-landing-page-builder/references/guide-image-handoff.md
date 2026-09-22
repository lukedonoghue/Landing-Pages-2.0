# Native PDF-image handoff

When buyer-guide research has no appropriate permitted image for the cover or a chapter, create one **illustrative** asset in the existing `image-plan.json`. Do not use this route for reviewer avatars, customers, employees, real projects or other proof. Website/supplied imagery is the first choice; a missing native tool is not permission to use API billing or ship a bare guide.

Use the existing plan's explicit generation budget, purpose, placements, rights and native generation mode. Record the actual reason the reusable sources are insufficient. Then prepare the saved handoff:

```sh
python3 scripts/guide_image_handoff.py request . --asset guide-comparison --placement choices --prompt "The researched explanatory illustration prompt, with labelled concepts and no fabricated proof." --reason "The researched website lacks a reusable explanatory image for this buyer decision."
```

The controller returns `kind: image_handoff` with the existing attempt ID and native tool arguments. The active host calls its actual image-generation tool once. A standalone CLI/wizard without that tool shows the request and waits; it does not recursively launch Codex/Claude, start another attempt, infer tool availability from the subscription, or ask for a new API key. Repeated status/resume retains the same request. A closed chat is not an active executor.

Save the actual returned image and tool response as project-local research evidence, then register with the maintained image workflow:

```sh
python3 scripts/image_workflow.py --plan image-plan.json register-generation --id guide-comparison --attempt ACTUAL_ATTEMPT_ID --file research/actual-tool-output.png --tool-evidence research/actual-tool-result.json
python3 scripts/guide_image_handoff.py link . --caption "Illustration explaining the researched choices; not an actual client installation."
```

Only name a model when the real tool result reports it. No generated result may be inferred from a prompt or placeholder file. Registration checks the actual file and retained evidence; it cannot authenticate a fabricated operator/tool transcript. The controller resumes only after linkage. Linking copies those same bytes into public guide imagery with hashes, purpose, rights and an illustration caption. It does not pass image/editorial QA: build, inspect all PDF pages and regenerate/review the confirmation page normally.

If an image-capable session is unavailable, acquire an appropriate permitted supplied/website asset through `image_workflow.py`. After positively confirming the pending generation is not running, resolve the request using that acquired asset:

```sh
python3 scripts/guide_image_handoff.py use-source . --source-asset acquired-source-id --caption "A factual description of the permitted source image." --confirmed-no-running-generation
```

Never use that flag for an unknown tool outcome. The fallback retains source provenance, records that the native request was not completed, and does not label the supplied image generated. Business/guide changes invalidate pending requests. An occupied guide image slot or changed output blocks replacement rather than overwriting the owner's work. The old attempt is retained for diagnosis; repair budgets are not silently reset.

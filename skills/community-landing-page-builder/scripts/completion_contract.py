"""Shared completion requirements used by check_gates and both exporters.

Checks inspect retained evidence; they do not authenticate authors or perform
research, image generation, browser tests, consent, or publication on their behalf.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

PASS = {"pass", "pass_with_warnings"}
# Evidence inputs previously hidden by excluding the entire build directory.
CANONICAL_INPUTS = (
    "build/page-copy.json", "build/page-copy.md", "build/client-copy-brief.json",
    "build/copy-context.json", "build/strategy-brief.md", "build/claim-ledger.md",
    "build/copy-editorial-review.json", "build/copy-review-inputs.json",
    "build/guide-business.json", "build/brand.json", "build/page-structure.json",
    "build/reference-fidelity.json", "build/review-insights.json",
    "build/testimonial-selection.json", "build/research-acceptance.json",
    "build/document-sources.json", "build/guide.json", "build/thank-you.json",
)
DERIVED_DOCS = {"docs/QA-REPORT.md", "docs/PREVIEW-QA.md", "README-DELIVERY.md"}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object: {Path(path).name}")
    return value


def evidence(root, record):
    """Only project-local, non-secret, nonsymlink, hash-bound evidence is usable."""
    import workflow_storage
    import check_gates
    if not isinstance(record, dict) or not isinstance(record.get("path"), str):
        raise ValueError("Evidence needs a project-relative path and sha256")
    if Path(record["path"]).is_absolute():
        raise ValueError("Evidence paths must be portable and relative")
    path = workflow_storage.path_inside(root, record["path"])
    check_gates.resolve_inside(root, record["path"])
    if not path.is_file() or digest(path) != record.get("sha256"):
        raise ValueError("Missing or changed evidence: " + record["path"])
    return path


def text(value):
    return isinstance(value, str) and bool(value.strip())


def exception(root, record, label):
    """A limitation is documented, not an assertion that an unperformed test passed."""
    if not isinstance(record, dict) or not text(record.get("reason")) or not text(record.get("reviewer")):
        raise ValueError(label + " needs a specific reason and reviewer")
    attempts = record.get("attempts")
    if not isinstance(attempts, list) or not attempts:
        raise ValueError(label + " needs the actual attempted sources and outcomes")
    for attempt in attempts:
        if not isinstance(attempt, dict) or not text(attempt.get("source")) or not text(attempt.get("outcome")):
            raise ValueError(label + " has an incomplete acquisition/research attempt")
        evidence(root, attempt.get("evidence"))
    evidence(root, record.get("evidence"))


def research(root):
    """Require research coverage, not invented testimonials or unused paperwork."""
    failures = []
    try:
        record = read(root / "build/research-acceptance.json")
        if record.get("status") != "pass" or not text(record.get("reviewer")):
            raise ValueError("Research acceptance needs an actual reviewer and pass decision")
        sources = record.get("sources", [])
        if not sources or not any(s.get("kind") == "official_site" for s in sources if isinstance(s, dict)):
            raise ValueError("Research needs retained official-site evidence")
        for source in sources:
            evidence(root, source)
        angles = record.get("positioning_angles", [])
        if not isinstance(angles, list) or not 1 <= len(angles) <= 3:
            raise ValueError("Compare up to three supported positioning angles")
        if len(angles) == 1:
            exception(root, record.get("single_angle_reason"), "Single-angle positioning")
        chosen = record.get("selected_angle_id")
        if sum(isinstance(a, dict) and a.get("id") == chosen for a in angles) != 1:
            raise ValueError("Chosen positioning must identify one compared angle")
        for angle in angles:
            if not isinstance(angle, dict) or any(not text(angle.get(k)) for k in ("id", "angle", "buyer_relevance", "specificity", "rationale")):
                raise ValueError("Every positioning angle needs buyer relevance, specificity and a reasoned decision")
            evidence(root, angle.get("evidence"))
        # This acknowledges discovery is not acquisition. A failure is retained;
        # the image gate separately verifies the chosen permitted fallback bytes.
        attempts = record.get("first_party_image_attempts", [])
        if not isinstance(attempts, list) or not attempts:
            raise ValueError("First-party image discovery/acquisition attempts are missing")
        for attempt in attempts:
            if not isinstance(attempt, dict) or attempt.get("status") not in {"acquired", "unavailable", "unsuitable", "not_permitted"} or not text(attempt.get("reason")):
                raise ValueError("Image attempts need an honest acquisition outcome and reason")
            evidence(root, attempt.get("evidence"))
        for key in ("claim_scope_review", "copy_repetition_review", "buyer_questions_review"):
            review = record.get(key, {})
            if review.get("status") != "pass" or not text(review.get("observations")):
                raise ValueError(key + " needs concrete editorial observations, not a bare pass")
            evidence(root, review.get("evidence"))
        manifest = root / "research/reviews/review-manifest.json"
        if manifest.is_file():
            import review_workflow
            import validate_reviews
            checked = validate_reviews.validate_project(root, stage="research")
            if checked.get("status") not in PASS:
                raise ValueError("Review identity/provenance validation is blocked: " + str(checked.get("errors", checked)))
            expected = review_workflow.aggregate(read(manifest), digest(manifest))
            actual = read(root / "build/review-insights.json")
            if any(actual.get(key) != expected[key] for key in ("review_manifest_sha256", "review_count", "themes")):
                raise ValueError("Review insights are missing, stale or differ from the matched-source analysis")
            if not expected["review_count"]:
                exception(root, record.get("review_exception"), "No usable matched reviews")
        else:
            exception(root, record.get("review_exception"), "Review research not completed")
        brand = root / "build/brand.json"
        if brand.is_file():
            measured = read(brand)
            if measured.get("kind") != "rendered_brand_measurement" or measured.get("status") not in PASS:
                raise ValueError("Brand record is not a successful rendered-font measurement")
            if not measured.get("measurements") or not measured.get("artifacts"):
                raise ValueError("Brand evidence must retain measurements and captures")
            for item in measured["artifacts"]:
                # extract_brand paths are relative to the report directory.
                linked = dict(item)
                linked["path"] = (Path("build") / item["path"]).as_posix()
                evidence(root, linked)
        else:
            exception(root, record.get("brand_exception"), "Rendered brand measurement unavailable")
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        failures.append("Research: " + str(error))
    return failures


def coverage(root):
    failures = []
    try:
        import process_contract
        failures += process_contract.validate_reference_fidelity(root)
        fidelity = read(root / "build/reference-fidelity.json")
        structure = read(root / "build/page-structure.json")
        if not fidelity.get("sources"):
            failures.append("Reference coverage has no source identities")
        sections = structure.get("sections", [])
        ids = {s.get("id") for s in sections if isinstance(s, dict) and text(s.get("id"))}
        if not sections or len(ids) != len(sections):
            failures.append("Final page sections must have nonempty unique identities")
        for row in fidelity.get("coverage", []):
            if not isinstance(row, dict):
                continue
            if row.get("disposition") != "omitted":
                targets = row.get("section_ids", [row.get("section_id")])
                if not targets or not set(targets).issubset(ids):
                    failures.append("Reference role has no actual final section: " + str(row.get("reference_id")))
        questions = structure.get("buyer_questions", [])
        if not questions:
            failures.append("Buyer questions are not mapped to final sections/proof")
        for row in questions:
            if not isinstance(row, dict) or not text(row.get("question")):
                failures.append("Buyer-question coverage contains an empty question")
            elif row.get("disposition") == "omitted":
                if not text(row.get("rationale")):
                    failures.append("Omitted buyer question needs an evidence-backed rationale")
                evidence(root, row.get("evidence"))
            elif row.get("section_id") not in ids or not text(row.get("treatment")):
                failures.append("Buyer question has no concrete treatment in an actual section")
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        failures.append("Coverage: " + str(error))
    return failures


def inspect(root):
    import process_contract
    import scan_surfaces
    import workflow
    root = Path(root).resolve()
    failures = []
    failures += process_contract.validate_documents(root)
    failures += research(root)
    failures += coverage(root)
    failures += document_source_errors(root)
    try:
        failures += deployed_image_errors(root, read(root / 'image-plan.json'))
    except (OSError, ValueError, TypeError) as error:
        failures.append('Deployed image registration: ' + str(error))
    try:
        failures += workflow.copy_state(root).get("failures", [])
    except (OSError, ValueError, KeyError, TypeError) as error:
        failures.append("Canonical copy: " + str(error))
    # The scan includes public surfaces AND canonical project documentation;
    # tool internals and raw source quotes are not customer copy.
    scan = scan_surfaces.scan(root, exclude=DERIVED_DOCS)
    if scan.get("status") == "blocked":
        failures.append("Project surface scan is blocked; inspect scan_surfaces.py output")
    return {"status": "blocked" if failures else "pass", "failures": failures}


def warning_errors(root, report):
    warnings = report.get("warnings", [])
    dispositions = report.get("warning_dispositions", [])
    errors = []
    if report.get("status") == "pass_with_warnings" and not warnings:
        errors.append("A warning status requires the actual warning details")
    for warning in warnings:
        message = warning if isinstance(warning, str) else warning.get("message", warning.get("id"))
        matches = [d for d in dispositions if isinstance(d, dict) and d.get("warning") == message]
        if len(matches) != 1 or not text(matches[0].get("reason")) or matches[0].get("disposition") not in {"accepted_limit", "not_applicable"}:
            errors.append("Warning has no explicit evidence-based disposition: " + str(message))
            continue
        try:
            evidence(root, matches[0].get("evidence"))
        except (OSError, ValueError, TypeError) as error:
            errors.append(str(error))
    return errors


def independent_review_errors(root, provenance):
    if provenance.get("mode") != "independent":
        return []
    try:
        retained = read(evidence(root, provenance.get("execution_artifact")))
        if retained.get("status") != "completed" or retained.get("task_id") != provenance.get("reviewer_task_id"):
            raise ValueError("Separate reviewer execution is not linked to the declared reviewer task")
        if not text(retained.get("host")) or not text(retained.get("dispatch_id")) or not text(retained.get("raw_result")):
            raise ValueError("Independent review needs its actual host dispatch and returned result")
        if retained["task_id"] == provenance.get("builder_task_id"):
            raise ValueError("Builder execution is self-review, not independent review")
    except (OSError, ValueError, KeyError, TypeError) as error:
        return [str(error)]
    return []


def write_summary(root, result):
    """Render QA, owner handoff and status from one freshly evaluated aggregate.

    Export readiness is not local-final. Only a verified supported export returns
    local-final. Generated summaries are not inputs to their own fingerprint.
    """
    import check_gates
    import workflow_storage
    import validate_owner_handoff
    root = Path(root).resolve()
    with workflow_storage.lock(root):
        current = check_gates.source_snapshot(root)["source_fingerprint"]
        if result.get("source_fingerprint") != current:
            raise ValueError("Source changed before summary; evaluate the gates again")
        ready = result.get("status") in PASS
        exported = export_status(root, current) if ready else {"status": "blocked"}
        final = exported.get("status") == "pass"
        level = "local-final" if final else ("local-quality-ready" if ready else "local-preview")
        if result.get("mode") == "live" and ready:
            level = "live-verified"
        summary = {"schema_version": 1, "generated_at": check_gates.now(), **result,
                   "release_level": level, "export_required_for_local_final": not final,
                   "production_authorization": "separate actual user instruction required"}
        if final:
            summary["export_verification"] = exported["receipt"]
        lines = ["# Quality review", "", f"Status: **{level}** ({result['status']}).",
                 f"Source fingerprint: `{current}`", f"Scope: {result.get('mode')}", "",
                 "| Check | Current result | Findings |", "| --- | --- | --- |"]
        for gate, report in result.get("gates", {}).items():
            detail = "; ".join(report.get("failures", [])) or "Current evidence validated"
            lines.append(f"| {gate} | {report['status']} | {detail.replace('|', '/')} |")
        if not result.get("gates"):
            lines.append("| Required evidence | blocked | No accepted gate evidence was provided |")
        for label, key in (("Blocking findings", "failures"), ("Warning dispositions", "warnings"), ("Limits", "limits")):
            lines += ["", "## " + label, ""] + ["- " + str(x) for x in result.get(key, [])]
            if not result.get(key):
                lines.append("None recorded." if ready else "See the blocked checks above; absence is not a pass.")
        lines += ["", ("The exact archive passed supported export and clean-restore verification." if final else "A local-quality-ready result still requires verified export.") + " This report does not authorize publication or certify live delivery.", ""]
        qa_path = workflow_storage.path_inside(root, "docs/QA-REPORT.md")
        qa_path.parent.mkdir(parents=True, exist_ok=True)
        qa_path.write_text("\n".join(lines), encoding="utf-8")
        # Keep real owner/account observations, not stale free-form completion claims.
        owner = workflow_storage.read(root, "build/owner-handoff.json", {})
        owner.setdefault("domains", [])
        owner["blockers"] = [b for b in owner.get("blockers", []) if isinstance(b, dict) and not str(b.get("id", "")).startswith("qa-")]
        for index, failure in enumerate(result.get("failures", []), 1):
            owner["blockers"].append({"id": f"qa-{index}", "feature": "Local acceptance",
                "evidence": str(failure), "completed": "Preserved existing project files and inspectable evidence.",
                "preserve": "Do not repeat live submissions, erase source files or replace real research.",
                "resume": "Continue the failed check, then regenerate the aggregate summary.",
                "steps": [{"action": str(failure), "expected": "A real current result closes this finding."}]})
        owner.update({"schema_version": 1, "status": "action_required" if owner["blockers"] else "complete",
            "source_fingerprint": current, "release_level": level,
            "message": f"The project is {level}. " + ("Local checks and the exact exported archive are verified. " if final else ("Local checks are accepted; verified packaging is next. " if ready else "The listed checks still need attention. ")) + "Publication and live testing require separate authorization.",
            "qa_report": {"path": "docs/QA-REPORT.md", "sha256": digest(qa_path)}})
        # Existing owner usage/cleanup facts remain intact; missing setup is not
        # invented as complete when creating a new local-only record.
        if (root / "src/free-usage.js").is_file() and "usage_monitoring" not in owner:
            owner["usage_monitoring"] = {"status": "deferred", "decision": "Local-only handoff; production setup is a separately authorized stage.", "evidence": "No production usage measurement is included in this local gate evaluation.", "coverage": "Local build only; production usage is unverified.", "owner_note": "Production usage monitoring has not been verified."}
        for note in (owner.get("usage_monitoring", {}).get("owner_note"), owner.get("cleanup", {}).get("owner_note")):
            if note:
                owner["message"] += " " + note
        owner_errors = validate_owner_handoff.validate(owner, project=root)
        summary["owner_handoff_validation"] = {"status": "blocked" if owner_errors else "pass", "failures": owner_errors}
        if owner_errors:
            summary["status"] = "blocked"
            summary["release_level"] = "local-preview"
            owner["status"] = "action_required"
            owner["release_level"] = "local-preview"
            owner["message"] = "The project remains a local-preview. Owner handoff validation needs attention: " + "; ".join(owner_errors) + ". Publication is not authorized by this report."
            summary["failures"] = list(result.get("failures", [])) + ["Owner handoff: " + item for item in owner_errors]
            summary["gates"] = {**result.get("gates", {}), "owner_handoff": {"status": "blocked", "failures": owner_errors}}
            lines[2] = "Status: **local-preview** (blocked)."
            lines += ["", "## Owner handoff validation", ""] + ["- " + item for item in owner_errors]
            qa_path.write_text("\n".join(lines), encoding="utf-8")
            owner["qa_report"]["sha256"] = digest(qa_path)
        workflow_storage.write(root, "build/owner-handoff.json", owner)
        workflow_storage.write(root, "build/release-status.json", summary)
        workflow_storage.path_inside(root, "README-DELIVERY.md").write_text(
            "# Your landing-page handoff\n\n" + owner["message"] + "\n\nRead docs/QA-REPORT.md for the exact checks, remaining findings and source version.\n", encoding="utf-8")
        return summary


def browser_evidence_errors(root, report, gate):
    """Bind claimed viewport coverage to real image bytes and engine metadata."""
    import image_workflow
    errors, captured = [], []
    for record in report.get('artifacts', []):
        if not isinstance(record, dict) or record.get('type') != 'screenshot':
            continue
        try:
            path = evidence(root, record)
            viewport = record.get('viewport', {})
            width, height = viewport.get('width'), viewport.get('height')
            ratio = record.get('device_pixel_ratio', 1)
            if type(width) is not int or type(height) is not int or width < 1 or height < 1:
                raise ValueError('Screenshot is missing actual viewport width/height: ' + str(record.get('path')))
            if type(ratio) not in (int, float) or not 0.5 <= ratio <= 4:
                raise ValueError('Invalid screenshot device pixel ratio')
            info = image_workflow.image_info(path.read_bytes())
            if info['width'] != round(width * ratio):
                raise ValueError('Screenshot width differs from recorded viewport/DPR')
            captured.append((width, height, record.get('engine'), record.get('state')))
        except (OSError, ValueError, KeyError, TypeError) as error:
            errors.append(str(error))
    if gate == 'browser':
        required = {360, 390, 768, 1024, 1180, 1280, 1440}
        if not required.issubset({w for w, h, e, state in captured if state == 'page'}):
            errors.append('Every required viewport needs its actual page capture, not a filename or metadata-only claim')
        if not any(w == 1280 and h <= 600 for w, h, e, state in captured):
            errors.append('No actual 1280 short-height capture')
        if any(v.get('width') == 320 for v in report.get('viewports', []) if isinstance(v, dict)) and not any(w == 320 for w, h, e, state in captured):
            errors.append('Claimed 320 first-screen check has no capture')
    else:
        config = read(root/'funnel.json')
        required = set(config.get('quality', {}).get('browsers', ['chromium', 'webkit']))
        engines = report.get('engines', [])
        for name in required:
            matches = [e for e in engines if isinstance(e, dict) and e.get('name') == name]
            if len(matches) != 1 or matches[0].get('status') != 'pass' or not text(matches[0].get('version')):
                errors.append('Browser compatibility lacks a successful versioned engine: ' + name)
            if not any(engine == name for w, h, engine, state in captured):
                errors.append('No capture attributed to required engine: ' + name)
    return errors


def performance_errors(root, report):
    """Recompute mobile medians from raw Lighthouse records, not asserted metrics."""
    import statistics
    import math
    errors = []
    try:
        raw = [read(evidence(root, a)) for a in report.get('artifacts', []) if a.get('type') == 'lighthouse_json']
        if not raw:
            raise ValueError('Retain the actual Lighthouse JSON audits')
        measures = []
        for audit in raw:
            if audit.get('runtimeError') or audit.get('configSettings', {}).get('formFactor') != 'mobile':
                raise ValueError('A successful mobile Lighthouse run is required')
            if audit.get('configSettings', {}).get('throttlingMethod') not in {'simulate', 'devtools'}:
                raise ValueError('Mobile audit must retain its throttling configuration')
            values = {'performance': audit['categories']['performance']['score'] * 100,
                      'lcp_ms': audit['audits']['largest-contentful-paint']['numericValue'],
                      'cls': audit['audits']['cumulative-layout-shift']['numericValue'],
                      'tbt_ms': audit['audits']['total-blocking-time']['numericValue']}
            if any(type(v) not in (int,float) or not math.isfinite(v) or v < 0 for v in values.values()):
                raise ValueError('Mobile measurements must be finite nonnegative numbers')
            measures.append(values)
        actual = {key: statistics.median(row[key] for row in measures) for key in measures[0]}
        if actual != report.get('metrics'):
            raise ValueError('Reported performance metrics differ from retained raw audit medians')
        config = read(root/'funnel.json').get('quality', {}).get('performance', {})
        budgets = {'performance': config.get('minimum_score',90), 'lcp_ms':config.get('lcp_ms',2500),
                   'cls':config.get('cls',0.1), 'tbt_ms':config.get('tbt_ms',200)}
        for key, budget in budgets.items():
            if actual[key] < budget if key == 'performance' else actual[key] > budget:
                errors.append('Mobile performance budget failed: ' + key)
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        errors.append('Performance: ' + str(error))
    return errors


def deployed_image_errors(root, plan):
    """Compare deployed HTML/CSS image references with the selected asset registry.

    Runtime-selected states still require browser review. This check proves neither
    relevance nor rights; it closes the unused-files/unregistered-image loophole.
    """
    from html.parser import HTMLParser
    from urllib.parse import urlsplit, unquote
    import re
    import workflow_storage
    root = Path(root).resolve()
    page = root / 'public/index.html'
    if not page.is_file():
        page = root / 'index.html'
    if not page.is_file():
        return ['Final image acceptance needs an actual landing-page HTML file']
    public = page.parent
    references, styles, errors = set(), set(), []
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'}

    def reference(value, base, image=True):
        if not isinstance(value, str) or not value.strip():
            return
        value = value.strip()
        if value.startswith('#'):
            return
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            if image:
                errors.append('Retain and register the actual deployed image bytes rather than a remote/data URL: ' + value[:120])
            return
        path = unquote(parsed.path)
        candidate = public / path.lstrip('/') if path.startswith('/') else base / path
        try:
            relative = candidate.resolve().relative_to(root).as_posix()
            actual = workflow_storage.path_inside(root, relative)
            if not actual.is_file() or candidate.is_symlink():
                raise ValueError('Missing or symlinked deployed asset: ' + relative)
            if image:
                references.add(relative)
            else:
                styles.add(actual)
        except (ValueError, OSError) as error:
            errors.append(str(error))

    class Page(HTMLParser):
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == 'img':
                reference(attrs.get('src'), public)
            if tag in {'img', 'source'}:
                for candidate in attrs.get('srcset', '').split(','):
                    if candidate.strip():
                        reference(candidate.strip().split()[0], public)
            if tag == 'video':
                reference(attrs.get('poster'), public)
            if tag == 'link':
                if 'stylesheet' in attrs.get('rel', '').split():
                    reference(attrs.get('href'), public, False)
                elif 'icon' in attrs.get('rel', '').split():
                    reference(attrs.get('href'), public)

    try:
        html = page.read_text(encoding='utf-8')
        Page().feed(html)
        # Include inline styles as well as directly linked local stylesheets.
        for content, base in [(html, public)] + [(s.read_text(encoding='utf-8'), s.parent) for s in styles]:
            for value in re.findall(r'url\(\s*[\'\"]?([^\'\")]+)', content):
                if Path(urlsplit(value).path).suffix.lower() in image_extensions or value.startswith('data:image'):
                    reference(value, base)
        registered = {}
        for asset in plan.get('assets', []):
            paths = [row.get('path') for row in asset.get('variants', [])]
            paths += [asset.get('source', {}).get('path')]
            paths = {p for p in paths if isinstance(p, str)}
            for path in paths:
                registered.setdefault(path, set()).add(asset.get('id'))
            if asset.get('counts_toward_content_minimum', True) and asset.get('trust_class') != 'decorative' and not asset.get('omitted_reason'):
                if not paths.intersection(references):
                    errors.append('Content original is not used on the landing page: ' + str(asset.get('id')))
        for path in sorted(references - registered.keys()):
            errors.append('Deployed visual has no image-plan registration: ' + path)
    except (OSError, ValueError, TypeError, AttributeError) as error:
        errors.append('Deployed imagery: ' + str(error))
    return errors


def document_text(value, depth=2):
    """Readable rendering of canonical records; never writes editorial conclusions."""
    if isinstance(value, dict):
        return '\n\n'.join('#' * min(depth, 6) + ' ' + str(key).replace('_', ' ') + '\n\n' + document_text(item, depth + 1)
                           for key, item in value.items())
    if isinstance(value, list):
        return '\n\n'.join(document_text(item, depth) for item in value)
    return '' if value is None else str(value)


def render_documents(root):
    """Render explicitly mapped canonical inputs, not eleven independent drafts.

    An unmapped document remains independently authored and must still pass the
    normal document checks. No missing-source fallback or marker deletion exists.
    """
    import process_contract
    import workflow_storage
    root = Path(root).resolve()
    with workflow_storage.lock(root):
        mapping = read(root / 'build/document-sources.json').get('documents')
        if not isinstance(mapping, dict) or not mapping:
            raise ValueError('document-sources.json needs explicit document-to-source mappings')
        pending = {}
        for name, source in mapping.items():
            if name not in process_contract.BUILD_GATE_DOCS:
                raise ValueError('Unsupported derived document: ' + str(name))
            path = evidence(root, source)
            if path == root / 'docs' / name:
                raise ValueError('A derived document cannot be its own source')
            content = document_text(read(path)) if path.suffix == '.json' else path.read_text(encoding='utf-8')
            if process_contract.TEMPLATE_MARKER in content or len(process_contract.meaningful_text(content)) < process_contract.MINIMUM_MEANINGFUL_CHARACTERS[name]:
                raise ValueError('Canonical input is still incomplete for ' + name)
            pending[name] = '# ' + name[:-3].replace('-', ' ').title() + '\n\n' + content.rstrip() + '\n'
        # Validate every source before replacing any derived document.
        for name, content in pending.items():
            path = workflow_storage.path_inside(root, 'docs/' + name)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
        return {'status': 'pass', 'rendered': sorted(pending),
                'scope': 'Canonical document rendering only; no research/copy/QA acceptance is implied.'}


def document_source_errors(root):
    """Detect canonical/Markdown drift when an explicit mapping is supplied."""
    import process_contract
    path = root / 'build/document-sources.json'
    if not path.exists():
        return []  # Existing authored docs remain supported, and are validated.
    try:
        mapping = read(path).get('documents')
        if not isinstance(mapping, dict) or not mapping:
            raise ValueError('Canonical document mapping is empty')
        for name, source in mapping.items():
            if name not in process_contract.BUILD_GATE_DOCS:
                raise ValueError('Unsupported derived document: ' + str(name))
            original = evidence(root, source)
            content = document_text(read(original)) if original.suffix == '.json' else original.read_text(encoding='utf-8')
            expected = '# ' + name[:-3].replace('-', ' ').title() + '\n\n' + content.rstrip() + '\n'
            if (root/'docs'/name).read_text(encoding='utf-8') != expected:
                raise ValueError('Derived document is stale: docs/' + name)
    except (OSError, ValueError, KeyError, TypeError) as error:
        return ['Canonical documents: ' + str(error)]
    return []


def export_status(root, source_fingerprint=None):
    """Inspect the current supported export without treating a saved flag as proof.

    The archive stays outside its own hash. Check its bytes, manifest and current
    source, and require the exporter's actual clean-restore result. No new export
    is performed by this read-only inspector.
    """
    import check_gates
    import portable_handoff
    import workflow_storage
    import zipfile
    root = Path(root).resolve()
    try:
        config = workflow_storage.read(root, "funnel.json", {})
        if config.get("development_fixture"):
            raise ValueError("Development fixtures are not accepted client releases")
        current = source_fingerprint or check_gates.source_snapshot(root)["source_fingerprint"]
        receipt = workflow_storage.read(root, "build/export-verification.json", {})
        if receipt.get("schema_version") != 1 or receipt.get("scope") != "reviewed" or receipt.get("release_level") != "local-final":
            raise ValueError("A verified reviewed export is still required")
        if receipt.get("source_fingerprint") != current:
            raise ValueError("The export belongs to an earlier source snapshot")
        restored = receipt.get("restore_verification", {})
        if set(restored) != {"copy", "quality"} or any(v not in PASS for v in restored.values()):
            raise ValueError("The archive has no passing clean-restore verification")
        archive = Path(receipt.get("archive", ""))
        if not archive.is_absolute():
            archive = root / archive
        if archive.is_symlink() or not archive.is_file():
            raise ValueError("The verified archive is unavailable or symlinked")
        checked = portable_handoff.verify_archive(archive)
        manifest = checked["manifest"]
        if checked["sha256"] != receipt.get("sha256"):
            raise ValueError("Exported archive bytes changed after verification")
        if manifest["scope"] != "reviewed" or manifest["source_snapshot"]["source_fingerprint"] != current:
            raise ValueError("Archive scope or source differs from the accepted release")
        return {"status": "pass", "receipt": receipt, "failures": []}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, zipfile.BadZipFile) as error:
        return {"status": "blocked", "failures": [str(error)]}


def finalize_local(root):
    """Execute the existing checker, summary and exporter for the guided runner.

    This is orchestration of the existing authorities, not another acceptance
    implementation. It never runs research/tests or substitutes fabricated results.
    """
    import check_gates
    import portable_handoff
    import workflow_storage
    root = Path(root).resolve()
    result = check_gates.check(root, "handoff", root / "build/gates.json")
    summary = write_summary(root, result)
    if summary["status"] not in PASS:
        raise ValueError("Local handoff remains blocked: " + "; ".join(summary.get("failures", [])))
    existing = export_status(root, summary["source_fingerprint"])
    if existing["status"] != "pass":
        config = workflow_storage.read(root, "funnel.json", {})
        name = config.get("client", {}).get("name") or "Landing Page"
        # A source-specific destination preserves older accepted archives.
        output = root / "build/handoff" / (summary["source_fingerprint"] + ".zip")
        portable_handoff.export_bundle(root, output, name)
    summary = write_summary(root, check_gates.check(root, "handoff", root / "build/gates.json"))
    if summary.get("release_level") != "local-final":
        raise ValueError("Source or handoff changed during finalization; resume the current blockers")
    return summary


def visual_state_errors(root, report):
    """Require inspected states, not just a closed-page visual pass flag."""
    import image_workflow
    from html.parser import HTMLParser
    class PageRoles(HTMLParser):
        modal = False
        form = False
        def handle_starttag(self, tag, attrs):
            values = dict(attrs)
            self.form |= tag == "form"
            self.modal |= "data-open-modal" in values
    root = Path(root)
    roles = PageRoles()
    page = root / "public/index.html" if (root / "public/index.html").is_file() else root / "index.html"
    errors, states = [], set()
    try:
        roles.feed(page.read_text(encoding="utf-8"))
        for record in report.get("artifacts", []):
            if not isinstance(record, dict) or record.get("type") != "screenshot":
                continue
            width = record.get("viewport", {}).get("width")
            height = record.get("viewport", {}).get("height")
            ratio = record.get("device_pixel_ratio", 1)
            if type(width) is not int or type(height) is not int or width < 1 or height < 1:
                raise ValueError("Visual captures need actual viewport width and height")
            if type(ratio) not in (float, int) or not 0.5 <= ratio <= 4:
                raise ValueError("Visual capture has an invalid device pixel ratio")
            actual = image_workflow.image_info(evidence(root, record).read_bytes())
            if actual["width"] != round(width * ratio):
                raise ValueError("Visual capture bytes differ from viewport metadata")
            states.add((record.get("state"), "mobile" if width <= 600 else "desktop"))
        required = {"page"}
        if roles.modal:
            required |= {"modal_initial", "modal_error", "modal_focused"}
        if roles.form:
            required.add("server_error")
        if (page.parent / "thank-you.html").is_file():
            required.add("thank_you")
        for state in sorted(required):
            for device in ("desktop", "mobile"):
                if (state, device) not in states:
                    errors.append(f"Final visual acceptance lacks the {device} {state} capture")
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        errors.append("Visual state evidence: " + str(error))
    return errors

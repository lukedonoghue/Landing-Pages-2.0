#!/usr/bin/env python3
"""Plan, acquire, register, optimize and review source-grounded funnel imagery.

The native image_gen tool or explicitly selected official bundled CLI performs generation.
This script only prepares requests and registers evidence; it never needs an API key,
executes downloaded content, or labels prompt preparation as generation success.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import struct
import subprocess
import sys
import uuid
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

SCHEMA_VERSION = 2
MODELS = {"gpt-image-2.5-sunburst", "gpt-image-2.5-flare"}
MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 32_000_000
TRUST_CLASSES = {"client-proof", "illustrative", "decorative"}
# SKILL.md describes image roles (proof, portrait, diagram, screenshot); the plan
# stores the trust class. Accept those role words as aliases so both vocabularies work.
TRUST_CLASS_ALIASES = {"proof": "client-proof", "portrait": "illustrative", "diagram": "illustrative", "screenshot": "illustrative"}
# local-preview-only records an honest, unresolved reuse basis (for example an
# uncommissioned demonstration). Handoff and live gates refuse it.
RIGHTS = {"client-provided", "client-authorized", "licensed", "generated", "local-preview-only", "agent-created"}
# Who a local file came from. A file's location never implies client supply.
AUTHORITIES = {"user_attachment", "owner_instruction", "agent_created"}
# Rights that assert someone else's permission need a typed record, not builder prose.
RIGHTS_RECORDS = {"client-provided": {"user_attachment", "owner_instruction", "owner_authorization"},
                  "client-authorized": {"owner_instruction", "owner_authorization"},
                  "licensed": {"license"}}
# A final "not authorized": the owner's refusal, or a license reserving the photo to someone else.
REFUSAL_RECORDS = {"owner_refusal", "license"}
FIRST_PARTY = {"client-website", "client-supplied"}
# Every relevant first-party photo found in research ends in one of these.
DISPOSITIONS = {"used", "unsuitable", "reuse-not-authorized", "acquisition-failed", "no-download-tool"}
# This environment could not reach the host: the candidate stays open for the owner to supply.
ENVIRONMENT_FAILURES = {"network", "timeout", "tls-certificate", "non-public-address", "no-address"}
# The host answered for this URL: only these (and any HTTP status) close a candidate as acquisition-failed.
CANDIDATE_FAILURES = {"mime-mismatch", "invalid-image", "oversize", "redirect-limit", "redirect-no-location"}
STAGES = {"planned", "acquired", "generation-pending", "generation-failed", "optimized", "reviewed"}
MIME_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


class WorkflowError(ValueError):
    pass


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise WorkflowError(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def safe_path(root, relative):
    path = (root / relative).resolve()
    require(path.is_relative_to(root.resolve()), "Artifact must be inside the project root")
    return path


def artifact(root, path):
    path = Path(path).expanduser().resolve()
    require(path.is_file(), f"Missing evidence file: {path}")
    require(path.is_relative_to(root.resolve()), "Evidence must be copied into the project first")
    require(path.stat().st_size <= MAX_BYTES, "Evidence file exceeds 12 MiB")
    return {"path": str(path.relative_to(root.resolve())), "sha256": sha(path.read_bytes())}


def check_artifact(root, value):
    require(isinstance(value, dict) and nonempty(value.get("path")), "Missing artifact record")
    path = safe_path(root, value["path"])
    require(path.is_file(), f"Missing artifact: {value['path']}")
    require(path.stat().st_size <= MAX_BYTES, "Artifact exceeds 12 MiB")
    require(sha(path.read_bytes()) == value.get("sha256"), f"Artifact changed: {value['path']}")
    return path


def image_info(data):
    """Recognize supported raster containers and dimensions; cwebp later decodes them."""
    require(0 < len(data) <= MAX_BYTES, "Image must be between 1 byte and 12 MiB")
    mime = None
    width = height = 0
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 33 and data[12:16] == b"IHDR":
        width, height = struct.unpack(">II", data[16:24])
        require(b"IEND" in data[-16:], "Incomplete PNG")
        mime = "image/png"
    elif data.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 4 <= len(data):
            require(data[offset] == 255, "Invalid JPEG marker")
            while offset < len(data) and data[offset] == 255:
                offset += 1
            require(offset < len(data), "Incomplete JPEG")
            marker = data[offset]
            offset += 1
            if marker in {0xD8, 0xD9, 0x01} or 0xD0 <= marker <= 0xD7:
                continue
            require(offset + 2 <= len(data), "Incomplete JPEG segment")
            length = int.from_bytes(data[offset:offset + 2], "big")
            require(length >= 2 and offset + length <= len(data), "Invalid JPEG segment")
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                require(length >= 8, "Invalid JPEG frame")
                height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
                mime = "image/jpeg"
                break
            if marker == 0xDA:
                break
            offset += length
        require(data.endswith(b"\xff\xd9"), "Incomplete JPEG")
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP" and len(data) >= 30:
        require(int.from_bytes(data[4:8], "little") + 8 == len(data), "Incomplete WebP")
        kind = data[12:16]
        if kind == b"VP8X":
            width = 1 + int.from_bytes(data[24:27], "little")
            height = 1 + int.from_bytes(data[27:30], "little")
        elif kind == b"VP8 ":
            require(data[23:26] == b"\x9d\x01\x2a", "Invalid WebP frame")
            width, height = struct.unpack("<HH", data[26:30])
            width, height = width & 0x3FFF, height & 0x3FFF
        elif kind == b"VP8L":
            require(data[20] == 0x2F, "Invalid lossless WebP")
            bits = int.from_bytes(data[21:25], "little")
            width, height = 1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)
        mime = "image/webp"
    require(mime is not None and width > 0 and height > 0, "Use a valid PNG, JPEG or WebP raster; SVG/HTML are not image downloads")
    require(width * height <= MAX_PIXELS, "Image exceeds 32 megapixels")
    return {"mime": mime, "width": width, "height": height, "bytes": len(data), "sha256": sha(data)}


def stored_image(root, relative_dir, image_id, data):
    info = image_info(data)
    target = safe_path(root, f"{relative_dir}/{image_id}-{info['sha256'][:16]}{MIME_EXT[info['mime']]}")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        require(sha(target.read_bytes()) == info["sha256"], "Refusing to overwrite an existing asset")
    else:
        with target.open("xb") as stream:
            stream.write(data)
    return {"path": str(target.resolve().relative_to(Path(root).resolve())), **info}


def normalize_host(host):
    require(nonempty(host), "An explicit image hostname is required")
    require(not any(char in host for char in "/:@*"), "Use an exact hostname, without wildcards or a port")
    value = host.rstrip(".").lower().encode("idna").decode("ascii")
    require(value not in {"localhost", "localhost.localdomain"} and not value.endswith((".local", ".localhost")), "Local image hosts are prohibited")
    return value


def url_host(url):
    try:
        return normalize_host(urlsplit(url or "").hostname or "")
    except ValueError:
        return ""


def client_host(plan):
    """The client's site host without a leading www., so www, apex and subdomains all match."""
    host = url_host(plan.get("client_website")) if nonempty(plan.get("client_website")) else ""
    return host[4:] if host.startswith("www.") else host


def on_client_site(plan, url):
    host, observed = client_host(plan), url_host(url)
    return bool(host and observed) and (observed == host or observed.endswith("." + host))


def site_bound(plan):
    """A schema-1 plan written before client_website existed is not judged against a site it never named."""
    return plan.get("schema_version") == SCHEMA_VERSION or nonempty(plan.get("client_website"))


def validate_url(url, allowed_hosts, resolver=socket.getaddrinfo):
    parts = urlsplit(url)
    require(parts.scheme == "https" and parts.hostname and not parts.username and not parts.password, "Only HTTPS image URLs without credentials are supported")
    require(not parts.fragment, "Image URL must not contain a fragment")
    try:
        require(parts.port in (None, 443), "Only HTTPS port 443 is supported")
    except ValueError as exc:
        raise WorkflowError("Invalid image URL port") from exc
    host = normalize_host(parts.hostname)
    require(host in allowed_hosts, f"Image host is not allowlisted: {host}")
    addresses = sorted({row[4][0] for row in resolver(host, 443, type=socket.SOCK_STREAM)})
    require(addresses, "Image hostname has no usable address")
    parsed = [ipaddress.ip_address(address) for address in addresses]
    require(all(address.is_global and not address.is_multicast and not address.is_reserved for address in parsed), "Image host resolves to a non-public address")
    return parts, host, addresses[0]


def tls_context():
    """Verified TLS; prefer certifi so python.org macOS installs without system CA links still verify."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


CERTIFICATE_HELP = ("TLS certificate verification failed. Install the pinned build requirements "
                    "(python3 -m pip install -r requirements-build.txt, which includes certifi) or run the "
                    "Python 'Install Certificates.command'. Verification is never disabled.")


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, address):
        super().__init__(host, timeout=25, context=tls_context())
        self.address = address

    def connect(self):
        # Connect to the checked address while retaining the original TLS hostname.
        sock = socket.create_connection((self.address, 443), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def fetch_image(url, allowed_hosts, resolver=socket.getaddrinfo, connection_factory=PinnedHTTPSConnection):
    current = url
    for _ in range(4):
        parts, host, address = validate_url(current, allowed_hosts, resolver)
        connection = connection_factory(host, address)
        try:
            path = parts.path or "/"
            if parts.query:
                path += "?" + parts.query
            try:
                connection.request("GET", path, headers={"Accept": "image/png,image/jpeg,image/webp", "User-Agent": "LandingPages-ImageInventory/1.0"})
                response = connection.getresponse()
            except ssl.SSLCertVerificationError as error:
                raise WorkflowError(CERTIFICATE_HELP) from error
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                require(nonempty(location), "Image redirect has no location")
                current = urljoin(current, location)
                continue
            require(response.status == 200, f"Image request failed with HTTP {response.status}")
            mime = (response.getheader("Content-Type") or "").split(";", 1)[0].strip().lower()
            require(mime in MIME_EXT, "Server did not return a supported image MIME type")
            size = response.getheader("Content-Length")
            if size is not None:
                require(size.isdigit() and int(size) <= MAX_BYTES, "Image Content-Length is invalid or too large")
            data = response.read(MAX_BYTES + 1)
            info = image_info(data)
            require(info["mime"] == mime, "Image bytes do not match the server MIME type")
            return data, current
        finally:
            connection.close()
    raise WorkflowError("Image exceeded three redirects")


def srcset_urls(value):
    """Candidate URLs by the HTML srcset rules: a URL may itself contain commas (Cloudinary, Wix)."""
    urls, pos, size = [], 0, len(value)
    while pos < size:
        while pos < size and (value[pos].isspace() or value[pos] == ","):
            pos += 1
        start = pos
        while pos < size and not value[pos].isspace():
            pos += 1
        url = value[start:pos]
        if url.endswith(","):
            url = url.rstrip(",")
        else:
            depth = 0  # Skip the descriptors up to the next comma outside parentheses.
            while pos < size and (depth or value[pos] != ","):
                depth = depth + 1 if value[pos] == "(" else max(depth - 1, 0) if value[pos] == ")" else depth
                pos += 1
        if url:
            urls.append(url)
    return urls


class ImageInventory(HTMLParser):
    def __init__(self, page_url):
        super().__init__()
        self.page_url, self.images = page_url, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        values = []
        if tag in {"img", "source"}:
            # Lazy loaders keep the real URL in data-src, data-lazy-src, bv-orig-src,
            # data-srcset, bv-orig-srcset and similar; read every *src/*srcset attribute.
            for name, value in attrs.items():
                if not value or not isinstance(value, str):
                    continue
                if name.endswith("srcset"):
                    values += srcset_urls(value)
                elif name == "src" or name.endswith("-src") or name.endswith("_src"):
                    values.append(value)
        if tag == "meta" and attrs.get("property") == "og:image":
            values.append(attrs.get("content"))
        for value in values:
            if value and not value.startswith(("data:", "blob:")):
                candidate = urljoin(self.page_url, value)
                if urlsplit(candidate).scheme == "https":
                    self.images.append({"source_url": candidate, "observed_page": self.page_url, "observed_alt": attrs.get("alt", "")})


def validate_plan(plan):
    schema_version = plan.get("schema_version")
    require(schema_version in {1, SCHEMA_VERSION}, "Unsupported image-plan schema version")
    require(isinstance(plan.get("assets"), list), "Image plan must contain an assets list")
    require(isinstance(plan.get("inventory"), list), "Image plan must contain an inventory list")
    decision = plan.get("generation_decision")
    require(isinstance(decision, dict), "Image plan must contain a generation_decision")
    require(type(decision.get("needed")) is bool and nonempty(decision.get("reason")), "Generation decision needs a boolean needed value and a specific reason")
    require(isinstance(decision.get("gaps", []), list), "Generation decision gaps must be a list")
    minimum = plan.get("minimum_distinct_content_originals", 4 if schema_version == SCHEMA_VERSION else 0)
    require(type(minimum) is int and 0 <= minimum <= 30, "minimum_distinct_content_originals must be an integer from 0 to 30")
    exception = plan.get("content_minimum_exception")
    if schema_version == SCHEMA_VERSION and minimum != 4:
        require(isinstance(exception, dict) and nonempty(exception.get("reason")) and isinstance(exception.get("evidence"), dict), "New complete-page plans require four originals; a different minimum needs a documented existing scope exception and artifact evidence")
    if schema_version == SCHEMA_VERSION:
        # Research binding and first-party labels are judged against the business's own site.
        website = plan.get("client_website", "")
        require(website is None or (nonempty(website) and urlsplit(website).scheme in {"http", "https"} and url_host(website)),
                "Record client_website: the business's own site URL, or null when it has no website")
    for host in plan.get("allowed_hosts", []):
        require(normalize_host(host) == host, "Use normalized exact hostnames in allowed_hosts")
    budget = plan.get("generation_budget", {})
    for key in ("max_assets", "max_attempts_per_asset", "max_total_attempts"):
        require(type(budget.get(key)) is int and 0 <= budget[key] <= 30, f"Invalid generation budget: {key}")
    ids = set()
    for item in plan["assets"]:
        image_id = item.get("id", "")
        require(re.fullmatch(r"[a-z][a-z0-9-]{0,63}", image_id) is not None, "Use a short, lowercase hyphenated image id")
        require(image_id not in ids, "Duplicate asset id")
        ids.add(image_id)
        if item.get("trust_class") in TRUST_CLASS_ALIASES:
            item["trust_class"] = TRUST_CLASS_ALIASES[item["trust_class"]]
        require(item.get("trust_class") in TRUST_CLASSES, "Each image needs a trust_class: " + ", ".join(sorted(TRUST_CLASSES)) + " (aliases: " + ", ".join(f"{k}={v}" for k, v in sorted(TRUST_CLASS_ALIASES.items())) + ")")
        require(item.get("stage", "planned") in STAGES, "Unknown image stage")
        require(type(item.get("required")) is bool, "Set required true or false for every image")
        for key in ("section", "purpose", "role"):
            require(nonempty(item.get(key)), f"Missing image {key}")
        if schema_version == SCHEMA_VERSION:
            require("source_original_ids" in item and "counts_toward_content_minimum" in item, "New image plans must explicitly record source_original_ids and counts_toward_content_minimum")
        originals = item.get("source_original_ids", [image_id])
        require(isinstance(originals, list) and originals and all(nonempty(value) for value in originals), "source_original_ids must name every independent source original represented in the pixels")
        require(len(originals) == len(set(originals)), "source_original_ids cannot contain duplicates")
        require(type(item.get("counts_toward_content_minimum", item["trust_class"] != "decorative")) is bool, "counts_toward_content_minimum must be boolean")
        if item.get("counts_toward_content_minimum") is False and item["trust_class"] != "decorative":
            require(nonempty(item.get("minimum_exclusion_reason")), "A non-decorative placement excluded from the content minimum needs minimum_exclusion_reason")
        require(isinstance(item.get("alt"), str), "Set image alt text, including empty alt for decoration")
        require(item["trust_class"] == "decorative" or nonempty(item["alt"]), "Informative images need alt text")
        for device in ("desktop", "mobile"):
            crop = item.get("placement", {}).get(device, {})
            require(nonempty(crop.get("aspect_ratio")), f"Missing {device} aspect ratio")
            focal = crop.get("focal_point", [])
            require(isinstance(focal, list) and len(focal) == 2 and all(type(n) in (int, float) and 0 <= n <= 1 for n in focal), "Focal point must be [x, y] between zero and one")
        generation = item.get("generation", {})
        if generation:
            require(generation.get("requested_model") in MODELS or (generation.get("mode", "native") == "native" and generation.get("requested_model") is None), "Use the native default or an explicitly requested supported model; no silent downgrade")
            require(generation.get("mode", "native") in {"native", "bundled-cli"}, "Generation mode must be native or explicitly selected bundled-cli")
            if generation.get("mode") == "bundled-cli":
                require(nonempty(generation.get("authorization_evidence")), "Bundled CLI mode requires the user's explicit CLI/API/model-path authorization evidence")
            require(type(generation.get("allow_unverified_native_model", False)) is bool, "allow_unverified_native_model must be boolean")
            if generation.get("allow_unverified_native_model"):
                require(nonempty(generation.get("model_exception_evidence")), "Record the user instruction allowing an unreported native model")
        if item["trust_class"] == "client-proof":
            require(not item.get("allow_generation", False), "Client proof must be sourced from real client evidence, never generated")
        for key in ("mobile", "desktop"):
            require(type(item.get("max_bytes", {}).get(key)) is int and 1 <= item["max_bytes"][key] <= MAX_BYTES, f"Set a {key} image byte budget")
    return plan


def load_plan(path):
    return validate_plan(json.loads(path.read_text(encoding="utf-8")))


def add_asset(plan, spec):
    """Append one planned placement; the complete plan is revalidated before saving."""
    require(isinstance(spec, dict) and nonempty(spec.get("id")), "The asset spec needs an id")
    require(all(item.get("id") != spec["id"] for item in plan["assets"]), "Asset id already exists")
    require(spec.get("stage", "planned") == "planned" and not spec.get("source") and not spec.get("variants"),
            "Add a planned placement only; acquire and optimize it with the normal commands")
    candidate = json.loads(json.dumps(plan))
    candidate["assets"].append({**spec, "stage": "planned"})
    validate_plan(candidate)
    plan["assets"].append(candidate["assets"][-1])
    return plan["assets"][-1]


def save_plan(path, plan, event, image_id=None):
    plan["updated_at"] = now()
    plan.setdefault("events", []).append({"at": plan["updated_at"], "event": event, "asset_id": image_id})
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        temporary.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def authority_record(root, value, kinds, file_sha=None):
    """A typed owner/user/license record file; builder-written prose is not authority."""
    require(isinstance(value, str) and value.strip().endswith(".json") and not Path(value).is_absolute(), "Cite a project-relative owner/user authority record file (.json), not a sentence")
    path = (Path(root) / value).resolve()
    require(path.is_relative_to(Path(root).resolve()) and path.is_file(), "Authority record is missing: " + value)
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise WorkflowError("Authority record must be JSON: " + value) from error
    require(isinstance(record, dict) and record.get("kind") in kinds, f"Authority record {value} must have kind {sorted(kinds)}")
    require(nonempty(record.get("message_id")) or nonempty(record.get("license_id")), "Authority record needs the owner's message or the license identity")
    if file_sha and record["kind"] in {"user_attachment", "owner_instruction"}:
        require(file_sha in record.get("files", []), "The authority record does not list this file's sha256")
    return record


def check_rights(root, rights, rights_evidence, file_sha=None):
    """An upload or owner-instruction record authorises only the files it lists (file_sha: the image's bytes)."""
    require(rights in RIGHTS - {"generated"} and nonempty(rights_evidence), "Record source rights and the client instruction or license evidence")
    if rights in RIGHTS_RECORDS:
        authority_record(root, rights_evidence, RIGHTS_RECORDS[rights], file_sha)


def inventory_file(plan, root, file, authority, evidence):
    source = Path(file).expanduser().resolve()
    require(source.is_file() and source.stat().st_size <= MAX_BYTES, "Supplied image is missing or too large")
    require(authority in AUTHORITIES, f"Record who made or supplied the file: {sorted(AUTHORITIES)}")
    info = image_info(source.read_bytes())
    record = artifact(root, evidence)
    if authority != "agent_created":
        authority_record(root, record["path"], {authority}, info["sha256"])
    origin = "agent-created" if authority == "agent_created" else "client-supplied"
    entry = {"id": "source-" + info["sha256"][:12], "local_file": str(source), "source_sha256": info["sha256"],
             "origin": origin, "authority": authority, "evidence": record}
    existing = next((v for v in plan["inventory"] if v["id"] == entry["id"]), None)
    if existing is not None:
        # An entry recorded before --authority existed is upgraded in place, so acquired assets keep their candidate_id.
        require(not existing.get("authority") and existing.get("origin") == "client-supplied" and existing.get("source_sha256") == entry["source_sha256"]
                and authority in {"user_attachment", "owner_instruction"}, "Source is already in the inventory")
        existing.update(local_file=entry["local_file"], authority=authority, evidence=record)
        return existing
    plan["inventory"].append(entry)
    return entry


def proof_candidate(plan, inventory_id):
    return next((c for c in plan.get("proof_candidates", []) if c.get("inventory_id") == inventory_id), None)


def add_candidate(plan, inventory_id, subject):
    """Register a relevant first-party photo found in research; it must later be disposed of."""
    matches = [entry for entry in plan["inventory"] if entry["id"] == inventory_id]
    require(len(matches) == 1, "Inventory the observed image first")
    require(matches[0].get("origin") in {"client-website", "client-supplied"}, "Only first-party images are proof candidates")
    require(len(str(subject).strip()) >= 8, "Describe what the photo shows (for example: finished bathroom remodel)")
    require(proof_candidate(plan, inventory_id) is None, "Already a proof candidate")
    entry = {"inventory_id": inventory_id, "source_url": matches[0].get("source_url"), "subject": subject.strip(), "disposition": None, "added_at": now()}
    # A photo a client-proof placement already holds (acquired before the ledger saw it) is used; no re-acquisition needed.
    holder = next((a for a in plan.get("assets", []) if a.get("trust_class") == "client-proof" and a.get("provenance", {}).get("candidate_id") == inventory_id), None)
    if holder is not None:
        entry.update(disposition="used", asset_id=holder["id"], disposed_at=entry["added_at"])
    plan.setdefault("proof_candidates", []).append(entry)
    return entry


def dispose(plan, root, inventory_id, disposition, reason, evidence):
    candidate = proof_candidate(plan, inventory_id)
    require(candidate is not None, "Unknown proof candidate: " + str(inventory_id))
    require(disposition in {"unsuitable", "reuse-not-authorized", "no-download-tool"},
            "Use or attempt the image with acquire; used and acquisition-failed are recorded by that command")
    require(len(str(reason).strip()) >= 20, "Record the specific visual, rights or capability reason")
    record = artifact(root, evidence)
    if disposition == "reuse-not-authorized":
        # "Not yet authorized" is a local-preview-only acquisition, not this final disposition.
        authority_record(root, record["path"], REFUSAL_RECORDS)
    candidate.update(disposition=disposition, reason=reason.strip(), evidence=record, disposed_at=now())
    return candidate


FAILURE_TEXT = (("certificate", "tls-certificate"), ("non-public address", "non-public-address"), ("no usable address", "no-address"),
                ("mime type", "mime-mismatch"), ("three redirects", "redirect-limit"), ("redirect has no location", "redirect-no-location"),
                ("too large", "oversize"), ("12 mib", "oversize"), ("megapixels", "oversize"), ("raster", "invalid-image"),
                ("png", "invalid-image"), ("jpeg", "invalid-image"), ("webp", "invalid-image"), ("https", "invalid-url"),
                ("fragment", "invalid-url"), ("port", "invalid-url"), ("hostname", "invalid-url"), ("local image hosts", "invalid-url"))


def failure_class(error):
    text = str(error).lower()
    if "not allowlisted" in text:
        return "host-not-allowed"
    if isinstance(error, WorkflowError):
        code = re.search(r"http (\d{3})", text)
        return "http-" + code.group(1) if code else next((kind for needle, kind in FAILURE_TEXT if needle in text), "WorkflowError")
    if isinstance(error, (TimeoutError, socket.timeout)) or "timed out" in text:
        return "timeout"
    if isinstance(error, ssl.SSLCertVerificationError) or "certificate" in text:
        return "tls-certificate"
    if isinstance(error, OSError):
        return "network"
    return type(error).__name__


def candidate_failure(kind):
    """The host answered for this URL, so the failure belongs to the candidate, not to this environment."""
    return bool(re.fullmatch(r"http-\d{3}", str(kind))) or kind in CANDIDATE_FAILURES


def acquisition_receipt(root, candidate, error):
    """Tool-written record of an actual failed attempt; narrative cannot stand in for it."""
    record = {"schema_version": 1, "candidate_id": candidate["id"], "source_url": candidate.get("source_url"),
              "tool": "image_workflow.acquire", "method": "https", "attempted_at": now(),
              "error_class": failure_class(error), "detail": str(error)[:500]}
    stamp = re.sub(r"[^0-9]", "", record["attempted_at"])[:20]
    # Inventory ids can be hand-recorded; the filename never carries one as a path.
    slug = re.sub(r"[^a-z0-9-]+", "-", str(candidate["id"]).lower()).strip("-")[:48] or "candidate"
    path = safe_path(Path(root), f"research/acquisition-receipts/{slug}-{sha(str(candidate['id']).encode())[:8]}-{stamp}.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return artifact(root, path)


def get_asset(plan, image_id):
    for item in plan["assets"]:
        if item["id"] == image_id:
            return item
    raise WorkflowError(f"Unknown image id: {image_id}")


def acquire(plan, root, image_id, candidate_id, rights, rights_evidence, proof_evidence="", fetcher=fetch_image, replaces=None):
    """replaces: a no-download-tool proof candidate that this owner-supplied file stands in for."""
    item = get_asset(plan, image_id)
    if item.get("stage") == "generation-failed":
        require(item.get("generation", {}).get("allow_source_fallback") is True, "Source fallback after generation failure was not enabled in the image plan")
    matches = [entry for entry in plan["inventory"] if entry["id"] == candidate_id]
    require(len(matches) == 1, "Choose exactly one observed inventory candidate")
    candidate = matches[0]
    check_rights(root, rights, rights_evidence)
    if candidate.get("origin") == "agent-created":
        require(rights == "agent-created" and item["trust_class"] != "client-proof", "An agent-created file is illustration with agent-created rights, never client proof")
    else:
        require(rights != "agent-created", "agent-created rights apply only to files the agent made")
    check_artifact(root, candidate["evidence"])
    if item["trust_class"] == "client-proof":
        require(candidate.get("origin") in FIRST_PARTY, "Proof must come from a client source")
        require(nonempty(proof_evidence), "Proof images require evidence of what real client work/person/project they depict")
    require(rights != "client-provided" or candidate.get("origin") == "client-supplied", "client-provided rights cover files the owner supplied; reusing a website photo needs --rights client-authorized with an owner_authorization record")
    proof = proof_candidate(plan, candidate_id)
    replaced = proof_candidate(plan, replaces) if replaces else None
    if replaces:
        require(replaced is not None and replaced.get("disposition") == "no-download-tool", "--replaces closes a no-download-tool proof candidate (a photo this environment could not download)")
        require(candidate.get("origin") == "client-supplied" and candidate.get("authority") in {"user_attachment", "owner_instruction"},
                "--replaces needs the owner's own file, inventoried with inventory-file --authority user_attachment or owner_instruction")
        require(item["trust_class"] == "client-proof", "--replaces fills a client-proof placement")
    elif candidate.get("origin") in FIRST_PARTY:
        require(proof is not None, "Register this business photo with `candidate` first; the proof ledger must see every first-party photo on the page")
        require(item["trust_class"] == "client-proof" or proof.get("disposition") == "unsuitable",
                "A business photo outside a client-proof placement needs its candidate disposed as unsuitable first (why it cannot serve as proof)")
    if candidate.get("local_file"):
        source = Path(candidate["local_file"]).expanduser().resolve()
        require(source.is_file() and source.stat().st_size <= MAX_BYTES, "Missing or oversized supplied file")
        require(sha(source.read_bytes()) == candidate.get("source_sha256"), "Supplied source changed since inventory")
        data, final_url = source.read_bytes(), None
    else:
        try:
            data, final_url = fetcher(candidate["source_url"], plan["allowed_hosts"])
        except (WorkflowError, OSError, http.client.HTTPException) as error:
            # Only a proof attempt settles the candidate; a failed non-proof use keeps its unsuitable disposition.
            if proof is None or item["trust_class"] != "client-proof":
                raise
            kind, receipt = failure_class(error), acquisition_receipt(root, candidate, error)
            if kind not in ENVIRONMENT_FAILURES:
                proof.update(disposition="acquisition-failed", receipt=receipt, disposed_at=now())
                error.proof_receipt = receipt
                raise
            # This environment could not reach the host: not a failure of the photo, and not a reason to drop it.
            proof.update(disposition="no-download-tool", reason=f"This environment could not reach the image host ({kind}); the owner needs to supply this photo.",
                         evidence=receipt, receipt=receipt, disposed_at=now())
            failure = WorkflowError(f"{error} [{kind}] This environment could not download the photo, so {candidate_id} stays open for the owner: retry where downloads work, "
                                    f"or ask the owner to attach it, run inventory-file --authority user_attachment, then acquire --candidate <attached id> --replaces {candidate_id}.")
            failure.proof_receipt = receipt
            raise failure from error
    check_rights(root, rights, rights_evidence, sha(data))
    info = stored_image(root, "research/image-originals", item["id"], data)
    item.update({"stage": "acquired", "source": info, "provenance": {"kind": "actual", "candidate_id": candidate_id, "source_url": candidate.get("source_url"), "final_url": final_url, "evidence": candidate["evidence"], "rights": rights, "rights_evidence": rights_evidence, "client_proof_evidence": proof_evidence, "acquisition": {"status":"acquired", "retrieved_at":now(), "sha256":info["sha256"], "width":info.get("width"), "height":info.get("height"), "content_type":image_info(data).get("mime"), "http_status":None if candidate.get("local_file") else 200, "observed_page":candidate.get("observed_page"), "method":"supplied" if candidate.get("origin")=="client-supplied" else "https", "source_url":candidate.get("source_url"), "final_url":final_url}}, "generated_disclosure": None})
    if replaced is not None:
        item["provenance"]["replaces_candidate"] = replaces
    item.pop("variants", None)
    item.pop("review", None)
    if proof is not None and item["trust_class"] == "client-proof":
        proof.update(disposition="used", asset_id=item["id"], disposed_at=now())
        proof.pop("receipt", None)
        proof.pop("replacement_inventory_id", None)
    if replaced is not None:
        replaced.update(disposition="used", asset_id=item["id"], replacement_inventory_id=candidate_id, disposed_at=now())
        replaced.pop("receipt", None)
    return info


def bundled_cli_info(path):
    """Inspect supported CLI capability without executing or modifying the bundle."""
    path = Path(path).expanduser().resolve()
    require(path.is_file(), "The official imagegen bundled CLI does not exist at the supplied path")
    require(path.name == "image_gen.py" and path.parent.name == "scripts" and path.parent.parent.name == "imagegen", "Use the official imagegen/scripts/image_gen.py, not a custom runner")
    require(path.stat().st_size <= 2 * 1024 * 1024, "Unexpected bundled CLI size")
    text = path.read_text(encoding="utf-8")
    require(all(option in text for option in ('"--model"', '"--prompt-file"', '"--out"', '"--dry-run"')), "Bundled CLI does not advertise required model/prompt/output/dry-run controls")
    require("GPT_IMAGE_MODEL_PREFIX" in text and "def _validate_model(" in text, "Inspect this changed CLI's exact-model support before use")
    return {"path": str(path), "sha256": sha(path.read_bytes())}


def prepare_generation(plan, image_id, prompt, root=None, imagegen_cli=None, dry_run=False):
    item = get_asset(plan, image_id)
    require(item["trust_class"] != "client-proof", "Never generate client proof, staff, customer testimonials or project results")
    require(item.get("allow_generation") is True, "Generation is not enabled for this asset")
    require(nonempty(prompt), "Supply a complete production image prompt")
    generation = item.setdefault("generation", {})
    mode = generation.get("mode", "native")
    require(mode in {"native", "bundled-cli"}, "Unknown generation mode")
    require(generation.get("requested_model") in MODELS or (mode == "native" and generation.get("requested_model") is None), "Configure the requested GPT Image 2.5 variant for exact-model generation, or use the native default")
    if mode == "bundled-cli":
        require(nonempty(generation.get("authorization_evidence")), "Bundled CLI mode requires the user's explicit CLI/API/model-path authorization evidence")
        require(root is not None and imagegen_cli is not None, "Bundled CLI preparation needs the project root and --imagegen-cli path")
        cli = bundled_cli_info(imagegen_cli)
        root = Path(root).resolve()
    else:
        require(imagegen_cli is None, "Passing --imagegen-cli is not authorization; explicitly choose bundled-cli in the image plan first")
    attempts = plan.setdefault("generation_attempts", [])
    require(not any(a["asset_id"] == image_id and a["status"] == "pending" for a in attempts), "Resolve the pending generation attempt before retrying")
    budget = plan["generation_budget"]
    require(len(attempts) < budget["max_total_attempts"], "Total generation attempt budget exhausted")
    require(sum(a["asset_id"] == image_id for a in attempts) < budget["max_attempts_per_asset"], "Asset generation attempt budget exhausted")
    require(len({a["asset_id"] for a in attempts} | {image_id}) <= budget["max_assets"], "Generated asset budget exhausted")
    full_prompt = prompt.strip() + "\n\nUsage: " + item["section"] + "; " + item["purpose"] + ".\nConstraints: This is illustrative supporting imagery, not documentary evidence. Do not invent client staff, testimonials, logos, certificates, or before/after results. Preserve room and subject placement required by the page composition."
    attempt = {"id": uuid.uuid4().hex, "asset_id": image_id, "status": "pending", "started_at": now(), "requested_model": generation.get("requested_model"), "mode": mode, "tool": "image_gen", "request": {"prompt": full_prompt}}
    if mode == "bundled-cli":
        prompt_path = safe_path(root, f"research/image-prompts/{image_id}-{attempt['id']}.txt")
        output_path = safe_path(root, f"output/imagegen/{image_id}-{attempt['id']}.png")
        require(not prompt_path.exists() and not output_path.exists(), "Refusing to overwrite an existing generation artifact")
        if not dry_run:
            prompt_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with prompt_path.open("x", encoding="utf-8") as stream:
                stream.write(full_prompt + "\n")
        argv = [sys.executable, cli["path"], "generate", "--model", generation["requested_model"], "--prompt-file", str(prompt_path), "--out", str(output_path), "--size", "auto", "--quality", "medium", "--output-format", "png"]
        attempt.update({"tool": "imagegen-bundled-cli", "cli": cli, "authorization_evidence": generation["authorization_evidence"], "prompt_file": {"path": str(prompt_path.relative_to(root)), "sha256": sha((full_prompt + "\n").encode())}, "output_path": str(output_path.relative_to(root)), "request": {"argv": argv}})
    attempts.append(attempt)
    item["stage"] = "generation-pending"
    if mode == "bundled-cli":
        return {"attempt_id": attempt["id"], "mode": mode, "argv": argv, "requested_model": attempt["requested_model"], "model_selection": "Exact model selected in the official CLI request; successful execution and matching output evidence are still required.", "requires_environment": ["OPENAI_API_KEY"], "executed": False, "next": "Run this argv directly with the supported bundled CLI only after the recorded authorization. Keep API keys in the process environment. Register the real output and execution evidence; preparation alone is not a successful call."}
    return {"attempt_id": attempt["id"], "mode": mode, "tool": "image_gen.imagegen", "arguments": attempt["request"], "requested_model": attempt["requested_model"], "model_selection": "Native tool has no model selector; register only a model reported by the actual tool result. Otherwise record unverified.", "next": "Call the native tool once, inspect its result, save tool evidence, then register-generation with its actual output file."}


def pending_attempt(plan, image_id, attempt_id):
    matches = [a for a in plan.get("generation_attempts", []) if a["id"] == attempt_id and a["asset_id"] == image_id and a["status"] == "pending"]
    require(len(matches) == 1, "No matching pending generation attempt")
    return matches[0]


def register_generation(plan, root, image_id, attempt_id, source, tool_evidence, actual_model=None):
    item = get_asset(plan, image_id)
    require(item["trust_class"] != "client-proof" and item.get("allow_generation") is True, "Generated images cannot be registered as client proof")
    attempt = pending_attempt(plan, image_id, attempt_id)
    require(actual_model is None or attempt["requested_model"] is None or actual_model == attempt["requested_model"], "Reported model differs from the requested model; do not silently downgrade")
    source = Path(source).expanduser().resolve()
    require(source.is_file(), "Generation has no output file; do not mark it complete")
    require(source.stat().st_size <= MAX_BYTES, "Generated image exceeds 12 MiB")
    evidence = artifact(root, tool_evidence)
    evidence_text = Path(tool_evidence).read_text(encoding="utf-8")
    require(nonempty(evidence_text), "Tool result evidence is empty")
    mode = attempt.get("mode", "native")
    verification = "reported-by-tool" if actual_model else "unverified"
    selected_model = None
    if mode == "bundled-cli":
        require(source == safe_path(root, attempt["output_path"]), "Register the exact output file reserved for this CLI attempt")
        check_artifact(root, attempt["prompt_file"])
        cli_path = Path(attempt["cli"]["path"])
        require(cli_path.is_file() and sha(cli_path.read_bytes()) == attempt["cli"]["sha256"], "Bundled CLI changed since request preparation")
        execution = json.loads(evidence_text)
        require(execution.get("mode") == "bundled-cli" and execution.get("argv") == attempt["request"]["argv"], "CLI execution evidence must match the exact prepared argv")
        require(type(execution.get("exit_code")) is int and execution["exit_code"] == 0 and execution.get("dry_run") is False and execution.get("api_call_completed") is True, "CLI evidence does not establish a successful non-dry-run API call")
        require(execution.get("requested_model") == attempt["requested_model"], "CLI execution evidence used a different requested model")
        require(execution.get("output_sha256") == sha(source.read_bytes()), "CLI execution evidence refers to different output bytes")
        reported_model = execution.get("reported_model")
        require(reported_model is None or reported_model == attempt["requested_model"], "Provider reported a different model; no silent downgrade")
        require(actual_model is None or actual_model == reported_model, "CLI-selected model is not provider attestation; only claim a model actually reported by the provider")
        actual_model = reported_model
        selected_model = attempt["requested_model"]
        verification = "reported-by-provider" if reported_model else "selected-in-cli-request"
    else:
        from image_evidence import native_result
        try:
            execution = native_result(tool_evidence, sha(source.read_bytes()), actual_model)
        except ValueError as error:
            raise WorkflowError(str(error)) from error
        require(actual_model is None or execution.get("reported_model") == actual_model, "Claimed model differs from the retained native result")
    info = stored_image(root, "research/image-originals", image_id, source.read_bytes())
    attempt.update({"status": "registered", "finished_at": now(), "output_sha256": info["sha256"], "tool_evidence": evidence, "actual_model": actual_model, "selected_model": selected_model, "model_verification": verification})
    item.update({"stage": "acquired", "source": info, "provenance": {"kind": "generated", "attempt_id": attempt_id, "tool": attempt["tool"], "mode": mode, "provider": "openai-api" if mode == "bundled-cli" else "native-tool", "requested_model": attempt["requested_model"], "actual_model": actual_model, "selected_model": selected_model, "model_verification": attempt["model_verification"], "evidence": evidence, "rights": "generated", "rights_evidence": "Generated for this project; retain tool evidence and review rights for any reference inputs."}, "generated_disclosure": "AI-generated illustration; does not depict an actual client project, staff member, customer, or result."})
    item.pop("variants", None)
    item.pop("review", None)
    return info


def optimize(plan, root, image_id, helper=None):
    item = get_asset(plan, image_id)
    require(item.get("stage") in {"acquired", "optimized", "reviewed"}, "Acquire an actual image file before optimization")
    source = check_artifact(root, item.get("source"))
    info = image_info(source.read_bytes())
    require(shutil.which("cwebp") is not None, "Install cwebp before optimization; no fake variants will be recorded")
    helper = helper or Path(__file__).with_name("optimize_images.py")
    require(helper.is_file(), "Bundled optimize_images.py is missing")
    widths = sorted({min(width, info["width"]) for width in (480, 960, 1600)})
    web_root = "public/" if (root / "public").is_dir() else ""
    # Every optimization run gets a separate directory: the helper cannot overwrite prior variants.
    output = safe_path(root, f"{web_root}assets/images/optimized/{image_id}-{info['sha256'][:12]}-{uuid.uuid4().hex[:8]}")
    completed = subprocess.run([sys.executable, str(helper), str(source), str(output), "--widths", ",".join(map(str, widths))], capture_output=True, text=True, check=False)
    require(completed.returncode == 0, "Image optimization failed: " + completed.stderr[-1000:])
    result = json.loads(completed.stdout)
    variants = []
    for generated in result.get("generated", []):
        path = Path(generated["path"]).resolve()
        require(path.is_relative_to(output), "Optimizer output escaped its directory")
        metadata = image_info(path.read_bytes())
        require(metadata["mime"] == "image/webp" and metadata["width"] in widths, "Unexpected optimized variant")
        variants.append({"path": str(path.relative_to(root)), **metadata})
    require({item["width"] for item in variants} == set(widths), "Optimizer did not produce every responsive width")
    item.update({"stage": "optimized", "variants": variants})
    item.pop("review", None)
    return variants


def review_asset(plan, root, image_id, report_path):
    item = get_asset(plan, image_id)
    require(item.get("stage") in {"optimized", "reviewed"}, "Optimize before reviewing the final rendered assets")
    source = check_artifact(root, item.get("source"))
    source_info = image_info(source.read_bytes())
    require(all(item["source"].get(key) == value for key, value in source_info.items()), "Original image metadata is stale")
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    require(nonempty(report.get("reviewer")), "Record the visual reviewer")
    require(report.get("source_sha256") == sha(source.read_bytes()), "Review refers to a different original image")
    expected = {v["path"]: v["sha256"] for v in item["variants"]}
    require(report.get("variant_sha256") == expected, "Review must cover every exact optimized file")
    plan_files = {a.get("source", {}).get("sha256") for a in plan["assets"]} | {v.get("sha256") for a in plan["assets"] for v in a.get("variants", [])}
    for variant in item["variants"]:
        variant_info = image_info(check_artifact(root, variant).read_bytes())
        require(all(variant.get(key) == value for key, value in variant_info.items()), "Optimized image metadata is stale")
    for device in ("desktop", "mobile"):
        view = report.get(device, {})
        for flag in ("subject_visible", "crop_appropriate", "alt_appropriate", "no_false_claim", "page_layout_checked"):
            require(view.get(flag) is True, f"{device} review did not pass: {flag}")
        screenshot = artifact(root, root / view.get("screenshot", ""))
        screenshot_info = image_info(check_artifact(root, screenshot).read_bytes())
        require(screenshot["sha256"] != item["source"]["sha256"] and screenshot["sha256"] not in expected.values(), "Provide a rendered page screenshot, not the source asset")
        require(240 <= screenshot_info["width"] <= 5000, "Unexpected review screenshot width")
        viewport = view.get("viewport", {})
        require(type(viewport.get("width")) is int and type(viewport.get("height")) is int and viewport["height"] >= 300, "Record the browser viewport")
        require((device == "mobile" and 320 <= viewport["width"] <= 480) or (device == "desktop" and 1024 <= viewport["width"] <= 2560), "Review needs both desktop and mobile viewports")
        pixel_ratio = view.get("device_pixel_ratio", 1)
        require(type(pixel_ratio) in (int, float) and 1 <= pixel_ratio <= 4, "Invalid screenshot pixel ratio")
        require(screenshot_info["width"] == round(viewport["width"] * pixel_ratio), "Screenshot width does not match the reviewed viewport")
        served = view.get("served_variant")
        require(served in expected, "Record the exact variant loaded in the rendered page")
        variant = next(v for v in item["variants"] if v["path"] == served)
        require(variant["bytes"] <= item["max_bytes"][device], f"{device} served image exceeds its byte budget")
        # Evidence must be of this image in its placement, not one page capture reused for every asset.
        element = view.get("element", {})
        box = element.get("bbox", {})
        require(nonempty(element.get("selector")), f"{device} review must name the rendered element (selector); capture-image-reviews.mjs records it")
        require(all(isinstance(box.get(k), (int, float)) for k in ("x", "y", "width", "height")) and box["width"] > 0 and box["height"] > 0, f"{device} review needs the element's bounding box")
        require(element.get("resource_sha256") == variant["sha256"], f"{device} review's element is not serving the recorded variant")
        crop = artifact(root, root / view.get("element_screenshot", ""))
        crop_info = image_info(check_artifact(root, crop).read_bytes())
        require(crop["sha256"] != screenshot["sha256"], f"{device} element evidence must be a capture of the element, not the page screenshot")
        require(crop["sha256"] not in plan_files, f"{device} element evidence must be a rendered capture of the element, not a source or optimized image file")
        require(abs(crop_info["width"] - round(box["width"] * pixel_ratio)) <= 2, f"{device} element capture does not match the element's bounding box")
        view["screenshot_evidence"] = screenshot
        view["element_evidence"] = crop
    provenance = item.get("provenance", {})
    check_artifact(root, provenance.get("evidence"))
    require(provenance.get("kind") in {"actual", "generated"} and provenance.get("rights") in RIGHTS and nonempty(provenance.get("rights_evidence")), "Image has no recorded provenance or rights basis")
    if item["trust_class"] == "client-proof":
        require(provenance.get("kind") == "actual" and nonempty(provenance.get("client_proof_evidence")), "Client proof requires a real, identified client source")
    if provenance.get("kind") == "generated":
        require(nonempty(item.get("generated_disclosure")), "Generated imagery needs disclosure in the image plan and handoff")
        if provenance.get("model_verification") not in {"reported-by-tool", "reported-by-provider", "selected-in-cli-request"}:
            generation = item.get("generation", {})
            requests = [generation.get("requested_model"), provenance.get("requested_model")]
            requests.extend(a.get("requested_model") for a in plan.get("generation_attempts", []) if a.get("asset_id") == image_id)
            native_default = (
                not any(requests)
                and generation.get("mode", "native") == "native"
                and provenance.get("mode", "native") == "native"
                and (provenance.get("provider") == "native-tool" or provenance.get("tool") in {"image_gen", "image_gen.imagegen", "native image generation"})
                and provenance.get("actual_model") is None
                and provenance.get("model_verification") in {"unverified", "unreported"}
            )
            exception = generation.get("allow_unverified_native_model") is True and nonempty(generation.get("model_exception_evidence"))
            require(native_default or exception, "Native model was not reported; exact GPT Image 2.5 remains unverified until the user permits that limitation")
            if native_default:
                report.setdefault("warnings", []).append("Native generation model was not reported; no exact model was requested or verified.")
    item["review"] = {"at": now(), "report": artifact(root, report_path), "result": report}
    item["stage"] = "reviewed"
    return item["review"]


def preflight(plan, root):
    """Verify acquired inputs before layout; rendered acceptance belongs to gate().

    A composite may count multiple originals only with separate retained, hashed
    original bytes. Neither an arbitrary ID nor a derivative increases the count.
    """
    errors, originals, ids = [], set(), {}
    try:
        validate_plan(plan)
    except (ValueError, KeyError, TypeError) as exc:
        return {"passed": False, "errors": [str(exc)], "distinct_content_original_count": 0}
    if any(a.get("status") == "pending" for a in plan.get("generation_attempts", [])):
        errors.append("Resolve pending image requests before claiming asset readiness")
    for item in plan.get("assets", []):
        if not item.get("required") and item.get("omitted_reason") and not item.get("source"):
            continue
        try:
            require(item.get("stage") in {"optimized", "reviewed"}, "Acquire and optimize the selected image before layout")
            source = check_artifact(root, item.get("source"))
            info = image_info(source.read_bytes())
            require(all(item["source"].get(k) == v for k, v in info.items()), "Source image metadata is stale")
            require(bool(item.get("variants")), "Optimized responsive variants are missing")
            for variant in item["variants"]:
                actual = image_info(check_artifact(root, variant).read_bytes())
                require(all(variant.get(k) == v for k, v in actual.items()), "Optimized image metadata is stale")
            provenance = item.get("provenance", {})
            evidence = check_artifact(root, provenance.get("evidence"))
            require(provenance.get("rights") in RIGHTS and nonempty(provenance.get("rights_evidence")), "Image rights/reuse basis is missing")
            require(provenance.get("kind") in {"actual", "generated"}, "Image origin is unclassified")
            if provenance.get("kind") == "actual":
                candidates = [c for c in plan.get("inventory", []) if c.get("id") == provenance.get("candidate_id")]
                require(len(candidates) == 1, "Sourced image has no unique inventory identity")
                candidate = candidates[0]
                check_artifact(root, candidate.get("evidence"))
                check_rights(root, provenance.get("rights"), provenance.get("rights_evidence"), info["sha256"])
                require(provenance.get("rights") != "client-provided" or candidate.get("origin") == "client-supplied", "client-provided rights cover files the owner supplied; a website photo needs client-authorized rights")
                if candidate.get("origin") == "client-supplied":
                    require(candidate.get("authority") in {"user_attachment", "owner_instruction"}, "A client-supplied file needs a user attachment or owner instruction record; run inventory-file again with --authority user_attachment or owner_instruction and its typed record")
                    authority_record(root, candidate["evidence"]["path"], {candidate["authority"]}, candidate.get("source_sha256"))
                if candidate.get("origin") == "client-website" and site_bound(plan):
                    require(on_client_site(plan, candidate.get("observed_page")), "A client-website image needs an observed_page on the plan's client_website; inventory other sites as reference-website")
                if candidate.get("source_sha256"):
                    require(candidate["source_sha256"] == info["sha256"], "Acquired bytes differ from the supplied original")
                if item.get("trust_class") == "client-proof":
                    require(candidate.get("origin") in FIRST_PARTY and nonempty(provenance.get("client_proof_evidence")), "Client proof needs a real identified client source")
            else:
                require(item.get("trust_class") != "client-proof" and nonempty(item.get("generated_disclosure")), "Generated imagery must be disclosed illustration, never client proof")
                if provenance.get("mode", "native") == "native":
                    from image_evidence import native_result
                    native_result(evidence, info["sha256"], provenance.get("actual_model"))
                else:
                    receipt = json.loads(evidence.read_text())
                    require(receipt.get("mode") == "bundled-cli" and receipt.get("exit_code") == 0 and receipt.get("api_call_completed") is True and receipt.get("dry_run") is False and receipt.get("output_sha256") == info["sha256"], "Bundled generation lacks its successful exact-output execution record")
            if item.get("trust_class") == "decorative" or item.get("counts_toward_content_minimum") is False:
                continue
            lineage = item.get("source_original_ids", [item["id"]])
            original_records = item.get("original_evidence", {})
            require(len(lineage) == 1 or all(ident in original_records for ident in lineage), "Multiple original IDs require separately retained original_evidence; a composite cannot invent originals")
            for ident in lineage:
                original = check_artifact(root, original_records[ident]) if ident in original_records else source
                digest = image_info(original.read_bytes())["sha256"]
                require(ident not in ids or ids[ident] == digest, "An original identity refers to conflicting image bytes")
                ids[ident] = digest
                originals.add(digest)
        except (ValueError, OSError, KeyError, TypeError) as exc:
            errors.append(str(item.get("id", "unnamed")) + ": " + str(exc))
    minimum = plan.get("minimum_distinct_content_originals", 4)
    if len(originals) < minimum:
        errors.append(f"Only {len(originals)} independently retained content originals; need {minimum}. Repeated files, crops and PDF previews do not add originals.")
    return {"passed": not errors, "errors": errors, "distinct_content_original_count": len(originals)}


def gate(plan, root):
    import copy
    plan = copy.deepcopy(plan)  # Validation must not rewrite accepted evidence timestamps.
    asset_readiness = preflight(plan, root)
    errors = asset_readiness["errors"]
    minimum = plan.get("minimum_distinct_content_originals", 4)
    if plan.get("schema_version") == SCHEMA_VERSION and minimum != 4:
        try:
            check_artifact(root, plan.get("content_minimum_exception", {}).get("evidence"))
        except (WorkflowError, OSError, KeyError, ValueError) as exc:
            errors.append("content minimum exception: " + str(exc))
    if not plan["assets"] and minimum > 0:
        errors.append("No image plan: a complete landing page requires distinct content imagery")
    for item in plan["assets"]:
        if not item["required"] and item.get("omitted_reason") and not item.get("source"):
            continue
        try:
            require(item.get("stage") == "reviewed", "Image has not passed rendered desktop/mobile review")
            previous = item.get("review", {})
            path = check_artifact(root, previous.get("report"))
            for device in ("desktop", "mobile"):
                check_artifact(root, previous.get("result", {}).get(device, {}).get("screenshot_evidence"))
            # Re-run the evidence and byte-budget checks so stale files cannot pass.
            review_asset(plan, root, item["id"], path)
        except (WorkflowError, OSError, KeyError, ValueError) as exc:
            errors.append(item["id"] + ": " + str(exc))
    errors += reused_element_captures(plan)
    proof = proof_role(plan, root)
    errors += proof.pop("errors")
    distinct_originals = set()
    source_lineage = {}
    for item in plan["assets"]:
        if item.get("trust_class") == "decorative" or item.get("counts_toward_content_minimum", True) is False:
            continue
        if not item.get("required") and item.get("omitted_reason") and not item.get("source"):
            continue
        originals = set(item.get("source_original_ids", [item["id"]]))
        distinct_originals.update(originals)
        source_hash = item.get("source", {}).get("sha256")
        if source_hash:
            previous = source_lineage.setdefault(source_hash, originals)
            if previous != originals:
                errors.append(f"{item['id']}: identical source bytes use conflicting source_original_ids")
    if len(distinct_originals) < minimum:
        errors.append(f"Only {len(distinct_originals)} independent content originals count toward the required {minimum}; derivatives, repeated photos and document previews do not add originals")
    return {"schema_version": 1, "gate": "images", "passed": not errors, "errors": errors,
            "asset_count": len(plan["assets"]), "distinct_content_original_count": asset_readiness["distinct_content_original_count"],
            "distinct_content_original_ids": sorted(distinct_originals), "proof_role": proof, "checked_at": now()}


URL_TOKEN = re.compile(r"https?://[^\s<>()\[\]\"'`|]+", re.I)
RASTER_PATH = re.compile(r"\.(?:jpe?g|png|webp|avif)(?![a-z0-9])", re.I)


def url_key(url):
    """One image however it is written: http or https, any host case, no fragment."""
    parts = urlsplit(str(url).strip())
    return (url_host(url) or (parts.hostname or "").lower(), parts.path or "/", parts.query)


def bound_ids(plan):
    """Inventory ids the proof ledger accounts for, including an owner file standing in for a candidate."""
    return {key for c in plan.get("proof_candidates", []) for key in (c.get("inventory_id"), c.get("replacement_inventory_id")) if key}


def research_binding_errors(plan, root):
    """First-party images named in research must reach the ledger; they cannot silently disappear."""
    root = Path(root)
    keys = {url_key(c["source_url"]) for c in plan.get("proof_candidates", []) if nonempty(c.get("source_url"))}
    files = {key[:2] for key in keys if RASTER_PATH.search(key[1])}

    def listed(url):
        # A cache-busting or resizing query on the same image file is still that candidate.
        key = url_key(url)
        return key in keys or bool(RASTER_PATH.search(key[1])) and key[:2] in files
    inventory = [e for e in plan.get("inventory", []) if nonempty(e.get("source_url"))]
    first_party = {url_key(e["source_url"]) for e in inventory if e.get("origin") == "client-website"}
    elsewhere = {url_key(e["source_url"]) for e in inventory if e.get("origin") != "client-website"} - first_party
    errors = []
    record = root / "build/research-acceptance.json"
    if record.is_file():
        assets, bound = {a.get("id"): a for a in plan.get("assets", [])}, bound_ids(plan)
        for attempt in json.loads(record.read_text(encoding="utf-8")).get("first_party_image_attempts", []):
            if not isinstance(attempt, dict):
                continue
            url = attempt.get("source_url")
            if nonempty(url) and not listed(url):
                errors.append(f"Research recorded first-party image {url} but the image plan has no proof candidate for it; register it with `candidate` and dispose of it")
            if attempt.get("status") == "acquired" and attempt.get("asset_id"):
                if assets.get(attempt["asset_id"], {}).get("provenance", {}).get("candidate_id") not in bound:
                    errors.append(f"Research recorded first-party image {attempt['asset_id']} as acquired but no proof candidate holds its source; register it with `candidate`")
    notes = root / "docs/IMAGE-RESEARCH.md"
    if notes.is_file():
        # The client's site (www, apex and subdomains) plus the hosts its observed photos are served from.
        host, hosts = client_host(plan), {key[0] for key in first_party}
        for url in sorted({token.rstrip(".,;:!*") for token in URL_TOKEN.findall(notes.read_text(encoding="utf-8"))}):
            key = url_key(url)
            if key in elsewhere:
                continue  # A recorded reference image, even on a CDN the client also uses.
            on_site = bool(host) and (key[0] == host or key[0].endswith("." + host))
            if (key in first_party or ((on_site or key[0] in hosts) and RASTER_PATH.search(key[1]))) and not listed(url):
                errors.append(f"docs/IMAGE-RESEARCH.md lists client image {url}; make it a proof candidate (unsuitable is a valid disposition), or inventory it as reference-website if it is not the business's")
    return errors


class ServedImages(HTMLParser):
    """Paths an <img> or <source> can load; comments, hidden images and inert markup serve nothing."""
    def __init__(self):
        super().__init__()
        self.paths, self.inert = set(), 0

    def handle_starttag(self, tag, attrs):
        if tag in {"template", "noscript"}:
            self.inert += 1
            return
        attrs = dict(attrs)
        if self.inert or tag not in {"img", "source"} or "hidden" in attrs:
            return
        for url in [attrs.get("src") or ""] + srcset_urls(attrs.get("srcset") or ""):
            if url:
                self.paths.add(urlsplit(url).path.lstrip("/").removeprefix("./"))

    def handle_endtag(self, tag):
        if tag in {"template", "noscript"} and self.inert:
            self.inert -= 1


def rendered_proof_errors(plan, root):
    """A photo recorded as used must be served by the page, not just stored."""
    page = Path(root) / "public/index.html"
    served = ServedImages()
    served.feed(page.read_text(encoding="utf-8") if page.is_file() else "")
    assets = {a["id"]: a for a in plan.get("assets", [])}
    errors = []
    for candidate in plan.get("proof_candidates", []):
        if candidate.get("disposition") != "used":
            continue
        asset = assets.get(candidate.get("asset_id"), {})
        paths = [v.get("path", "") for v in asset.get("variants", [])]
        if not any(path and path.split("public/", 1)[-1].lstrip("/") in served.paths for path in paths):
            errors.append(f"Proof candidate {candidate.get('inventory_id')} is marked used but no <img> or <source> on public/index.html serves its image")
    return errors


def reused_element_captures(plan):
    """One capture cannot stand in for several images' reviews."""
    errors, captures = [], {}
    for item in plan.get("assets", []):
        for device in ("desktop", "mobile"):
            digest = item.get("review", {}).get("result", {}).get(device, {}).get("element_evidence", {}).get("sha256")
            if digest and captures.setdefault((device, digest), item["id"]) != item["id"]:
                errors.append(f"{item['id']}: reuses {captures[(device, digest)]}'s {device} element capture; review each image in its own placement")
    return errors


def proof_role(plan, root):
    """First-party proof is judged separately from how many images the page has."""
    errors, unresolved, used = [], [], []
    assets = {a["id"]: a for a in plan.get("assets", [])}
    for candidate in plan.get("proof_candidates", []):
        ident, disposition = candidate.get("inventory_id"), candidate.get("disposition")
        label = f"proof candidate {ident} ({candidate.get('subject', '')})"
        try:
            require(disposition in DISPOSITIONS, f"{label} has no disposition; use it, or record why it is unsuitable, not authorized or could not be acquired")
            if disposition == "used":
                asset = assets.get(candidate.get("asset_id"), {})
                provenance, stand_in = asset.get("provenance", {}), candidate.get("replacement_inventory_id")
                # The asset holds the candidate itself, or the owner's file recorded as its replacement.
                require(provenance.get("candidate_id") is not None and (provenance["candidate_id"] == ident or (provenance["candidate_id"] == stand_in and provenance.get("replaces_candidate") == ident)),
                        f"{label} is marked used but no asset holds it")
                require(asset.get("trust_class") == "client-proof", f"{label} must carry the proof role (trust_class client-proof), not decoration or illustration")
                used.append(ident)
            elif disposition == "acquisition-failed":
                receipt = json.loads(check_artifact(root, candidate.get("receipt")).read_text(encoding="utf-8"))
                require(receipt.get("candidate_id") == ident and receipt.get("source_url") == candidate.get("source_url") and nonempty(receipt.get("attempted_at")) and nonempty(receipt.get("error_class")) and nonempty(receipt.get("tool")),
                        f"{label} needs the tool's failed-attempt receipt for this candidate")
                require(receipt["error_class"] != "host-not-allowed", f"{label}: the host was not allowlisted; add it to allowed_hosts and retry")
                if not candidate_failure(receipt["error_class"]):
                    unresolved.append(ident)  # This environment could not reach the host; the photo waits for the owner.
            else:
                require(len(str(candidate.get("reason", "")).strip()) >= 20, f"{label} needs a specific reason")
                check_artifact(root, candidate.get("evidence"))
                if disposition == "reuse-not-authorized":
                    authority_record(root, candidate["evidence"]["path"], REFUSAL_RECORDS)
                if disposition == "no-download-tool":
                    unresolved.append(ident)
        except (WorkflowError, OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(str(exc))
            unresolved.append(ident)
    # Every business photo on the page is in the ledger, whatever placement it fills.
    inventory, ledger = {e.get("id"): e for e in plan.get("inventory", [])}, {}
    for candidate in plan.get("proof_candidates", []):
        for key in (candidate.get("inventory_id"), candidate.get("replacement_inventory_id")):
            if key:
                ledger.setdefault(key, candidate)
    for asset in plan.get("assets", []):
        provenance = asset.get("provenance", {})
        source = provenance.get("candidate_id")
        if provenance.get("kind") != "actual" or inventory.get(source, {}).get("origin") not in FIRST_PARTY:
            continue
        candidate = ledger.get(source)
        if candidate is None:
            errors.append(f"{asset.get('id')} shows business photo {source}, which is not in the proof ledger; register it with `candidate`, then use it as proof or dispose of it")
            unresolved.append(source)
        elif asset.get("trust_class") != "client-proof" and candidate.get("disposition") not in {"used", "unsuitable"}:
            errors.append(f"{asset.get('id')} shows business photo {source} outside a proof placement; dispose of its candidate as unsuitable (why it cannot be proof) or give the placement the proof role")
            unresolved.append(candidate.get("inventory_id"))
    count = len(plan.get("proof_candidates", []))
    status = "unresolved" if unresolved else "none_identified" if not count else "proof_used" if used else "no_usable_proof"
    return {"errors": errors, "candidates": count, "used": used, "unresolved": sorted(set(unresolved)), "status": status}


@contextlib.contextmanager
def plan_lock(path):
    lock = path.with_name(path.name + ".lock")
    with lock.open("a") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        yield


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True, help="Project-root image-plan.json")
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--spec", type=Path, required=True, help="Adapt the bundled example before initializing")
    inv = sub.add_parser("inventory-html")
    inv.add_argument("--html", type=Path, required=True)
    inv.add_argument("--page-url", required=True)
    inv.add_argument("--origin", choices=["client-website", "reference-website"], required=True)
    local = sub.add_parser("inventory-file")
    local.add_argument("--file", type=Path, required=True)
    local.add_argument("--evidence", type=Path, required=True, help="user_attachment/owner_instruction: JSON record whose kind equals --authority, {kind, message_id, files:[sha256]}; agent_created: how the file was made")
    local.add_argument("--authority", choices=sorted(AUTHORITIES), required=True, help="Who supplied or made the file; a local path never implies client supply")
    cand = sub.add_parser("candidate", help="Register a relevant first-party photo found in research as a proof candidate")
    cand.add_argument("--id", required=True, help="Inventory id")
    cand.add_argument("--subject", required=True, help="What the photo shows")
    disp = sub.add_parser("dispose", help="Record why a proof candidate is not used")
    disp.add_argument("--id", required=True, help="Inventory id")
    disp.add_argument("--disposition", choices=["unsuitable", "reuse-not-authorized", "no-download-tool"], required=True)
    disp.add_argument("--reason", required=True)
    disp.add_argument("--evidence", type=Path, required=True, help="Visual, rights or capability evidence file")
    acq = sub.add_parser("acquire")
    acq.add_argument("--id", required=True)
    acq.add_argument("--candidate", required=True)
    acq.add_argument("--rights", choices=sorted(RIGHTS - {"generated"}), required=True)
    acq.add_argument("--rights-evidence", required=True)
    acq.add_argument("--proof-evidence", default="")
    acq.add_argument("--replaces", help="A no-download-tool proof candidate this owner-attached file stands in for")
    prep = sub.add_parser("prepare-generation")
    prep.add_argument("--id", required=True)
    prep.add_argument("--prompt-file", type=Path, required=True)
    prep.add_argument("--dry-run", action="store_true")
    prep.add_argument("--imagegen-cli", type=Path, help="Existing official imagegen/scripts/image_gen.py; requires explicit bundled-cli mode in the plan")
    reg = sub.add_parser("register-generation")
    reg.add_argument("--id", required=True)
    reg.add_argument("--attempt", required=True)
    reg.add_argument("--file", type=Path, required=True)
    reg.add_argument("--tool-evidence", type=Path, required=True)
    reg.add_argument("--actual-model", help="Only a model identity present in the retained tool result")
    fail = sub.add_parser("generation-failed")
    fail.add_argument("--id", required=True)
    fail.add_argument("--attempt", required=True)
    fail.add_argument("--reason", required=True)
    opt = sub.add_parser("optimize")
    opt.add_argument("--id", required=True)
    rev = sub.add_parser("review")
    rev.add_argument("--id", required=True)
    rev.add_argument("--report", type=Path, required=True)
    add = sub.add_parser("add-asset", help="Add one planned placement to an existing plan")
    add.add_argument("--spec", type=Path, required=True, help="JSON object with the same fields as an assets[] entry")
    sub.add_parser("validate")
    args = parser.parse_args()
    path = args.plan.expanduser().resolve()
    root = path.parent
    require(root.is_dir(), "Create the project folder first")
    # Like --rights-evidence, an evidence path may be written relative to the project.
    for name in ("evidence", "html"):
        value = getattr(args, name, None)
        if value is not None and not value.expanduser().is_absolute() and not value.exists():
            setattr(args, name, root / value)
    with plan_lock(path):
        if args.command == "init":
            require(not path.exists(), "Image plan exists; refusing to overwrite it")
            plan = load_plan(args.spec)
            save_plan(path, plan, "plan-created")
            output = {"path": str(path), "asset_count": len(plan["assets"])}
        else:
            plan = load_plan(path)
            if args.command == "inventory-html":
                evidence = artifact(root, args.html)
                require(urlsplit(args.page_url).scheme == "https", "Observed page must be HTTPS")
                require(args.origin != "client-website" or not site_bound(plan) or on_client_site(plan, args.page_url),
                        "--origin client-website needs a page on the plan's client_website; inventory other sites with --origin reference-website")
                inventory = ImageInventory(args.page_url)
                inventory.feed(args.html.read_text(encoding="utf-8"))
                added = []
                seen = {i.get("source_url") for i in plan["inventory"]}
                for value in inventory.images:
                    if value["source_url"] in seen:
                        continue
                    seen.add(value["source_url"])
                    entry = {"id": "source-" + sha(value["source_url"].encode())[:12], **value, "origin": args.origin, "evidence": evidence}
                    plan["inventory"].append(entry)
                    added.append(entry)
                output = {"candidates": added, "notice": "Candidates are observed URLs, not yet licensed, downloaded, or approved proof. Explicitly add observed CDN hosts to allowed_hosts before acquisition."}
            elif args.command == "inventory-file":
                output = inventory_file(plan, root, args.file, args.authority, args.evidence)
            elif args.command == "candidate":
                output = add_candidate(plan, args.id, args.subject)
            elif args.command == "dispose":
                output = dispose(plan, root, args.id, args.disposition, args.reason, args.evidence)
            elif args.command == "acquire":
                try:
                    output = acquire(plan, root, args.id, args.candidate, args.rights, args.rights_evidence, args.proof_evidence, replaces=args.replaces)
                except (WorkflowError, OSError, http.client.HTTPException) as error:
                    # Keep the tool's failed-attempt receipt even though the command fails.
                    if getattr(error, "proof_receipt", None):
                        save_plan(path, plan, "acquisition-failed", args.id)
                    raise
            elif args.command == "prepare-generation":
                output = prepare_generation(plan, args.id, args.prompt_file.read_text(encoding="utf-8"), root=root, imagegen_cli=args.imagegen_cli, dry_run=args.dry_run)
                if args.dry_run:
                    output["dry_run"] = True
                    output["attempt_id"] = None
                    print(json.dumps(output, indent=2))
                    return 0
            elif args.command == "register-generation":
                output = register_generation(plan, root, args.id, args.attempt, args.file, args.tool_evidence, args.actual_model)
            elif args.command == "generation-failed":
                attempt = pending_attempt(plan, args.id, args.attempt)
                require(nonempty(args.reason), "Record the actual failure")
                attempt.update({"status": "failed", "finished_at": now(), "reason": args.reason})
                get_asset(plan, args.id)["stage"] = "generation-failed"
                output = attempt
            elif args.command == "add-asset":
                output = add_asset(plan, json.loads(args.spec.read_text(encoding="utf-8")))
                args.id = output["id"]
            elif args.command == "optimize":
                output = optimize(plan, root, args.id)
            elif args.command == "review":
                output = review_asset(plan, root, args.id, args.report)
            else:
                output = gate(plan, root)
                print(json.dumps(output, indent=2))
                return 0 if output["passed"] else 1
            save_plan(path, plan, args.command, getattr(args, "id", None))
        print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (WorkflowError, OSError, ValueError, KeyError, http.client.HTTPException) as error:
        print(json.dumps({"error": str(error)}, indent=2), file=sys.stderr)
        raise SystemExit(1)

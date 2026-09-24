"""Offline validation of retained native image results, not provider authentication.

A real host result must be retained with its call ID, output linkage and raw text.
No validator can authenticate a receipt authored by an actor controlling all files.
"""
import hashlib
import json
from pathlib import Path


def native_result(path, output_sha256, requested_model=None):
    try:
        record = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError) as exc:
        raise ValueError("Native generation requires a structured retained tool result, not a raster-creation note") from exc
    if not isinstance(record, dict):
        raise ValueError("Native image result must be an object")
    if record.get("kind") != "native_image_result" or record.get("status") != "succeeded":
        raise ValueError("Native generation has no successful native_image_result")
    for key in ("tool", "tool_call_id", "output_id", "raw_result", "executed_at"):
        if not isinstance(record.get(key), str) or not record[key].strip():
            raise ValueError("Native generation is missing actual result linkage: " + key)
    from datetime import datetime, timezone
    try:
        timestamp = datetime.fromisoformat(record["executed_at"].replace("Z", "+00:00"))
        if timestamp.tzinfo is None or (timestamp - datetime.now(timezone.utc)).total_seconds() > 300:
            raise ValueError("Invalid image execution time")
    except (ValueError, TypeError) as exc:
        raise ValueError("Native image result requires a real timezone-aware execution timestamp") from exc
    if record["output_id"] not in record["raw_result"]:
        raise ValueError("Native output ID is not linked to the retained raw result")
    if record.get("output_sha256") != output_sha256:
        raise ValueError("Native result refers to different output bytes")
    if requested_model and record.get("reported_model") != requested_model:
        raise ValueError("Requested native model was not reported by the tool")
    return record

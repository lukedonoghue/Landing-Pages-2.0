"""Atomic project-local workflow records. Locks protect updates, not external actions."""

from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import tempfile


def path_inside(root, relative):
    root = Path(root).resolve()
    relative = Path(relative)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Workflow records must use project-relative paths.")
    path = root
    for part in relative.parts:
        path = path / part
        if path.is_symlink():
            raise ValueError("Workflow storage cannot use symlinks.")
    return path


def read(root, relative, default=None):
    path = path_inside(root, relative)
    if not path.exists():
        return default
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError("Workflow record must contain a JSON object: " + relative)
    return value


def write(root, relative, value):
    """Caller holds lock for read/modify/write. A failed write preserves the old record."""
    path = path_inside(root, relative)
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=".workflow-",
            suffix=".tmp",
            delete=False,
        ) as handle:
            pending = Path(handle.name)
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(pending, path)
    finally:
        if pending is not None and pending.exists():
            pending.unlink()


@contextmanager
def lock(root):
    path = path_inside(root, ".secrets/workflow-state.lock")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open("a") as handle:
        os.chmod(path, 0o600)
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

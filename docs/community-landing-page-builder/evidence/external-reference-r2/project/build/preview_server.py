"""Loopback-only preview server. Synthetic enquiries are validated and discarded."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import time
import uuid


ROOT = Path(__file__).resolve().parent.parent


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/api/enquiry":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > 8192:
            self._json(413, {"ok": False})
            return
        try:
            body = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self._json(400, {"ok": False})
            return
        if not isinstance(body, dict) or not all(str(body.get(key, "")).strip() for key in ("name", "email", "message")):
            self._json(422, {"ok": False})
            return
        mode = self.headers.get("X-Preview-Mode", "")
        if mode == "delay":
            time.sleep(2)
        if mode == "fail":
            self._json(503, {"ok": False})
            return
        self._json(201, {"ok": True, "receipt": "preview-" + uuid.uuid4().hex})

    def _json(self, status, value):
        payload = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(payload)
        except BrokenPipeError:
            pass

    def log_message(self, format, *args):
        if args and str(args[0]).startswith("POST"):
            return
        super().log_message(format, *args)


if __name__ == "__main__":
    port = int(os.environ.get("PREVIEW_PORT", "4173"))
    server = ThreadingHTTPServer(("127.0.0.1", port), PreviewHandler)
    print(f"Preview: http://127.0.0.1:{port}/", flush=True)
    server.serve_forever()

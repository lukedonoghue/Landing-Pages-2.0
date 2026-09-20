import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/__preview/enquiry":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= 16384:
            self.send_error(413)
            return
        try:
            values = json.loads(self.rfile.read(length))
            if not all(isinstance(values.get(key), str) and values[key].strip() for key in ("requestId", "name", "email", "message")):
                raise ValueError("Missing required field")
        except (ValueError, UnicodeDecodeError):
            self.send_error(400)
            return
        payload = json.dumps({"confirmed": True, "preview": True, "requestId": values["requestId"]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        if args and "__preview/enquiry" in str(args[0]):
            return
        super().log_message(format, *args)


parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8787)
args = parser.parse_args()
project = Path(__file__).resolve().parents[1] / "project"
handler = lambda *handler_args, **kwargs: PreviewHandler(*handler_args, directory=str(project), **kwargs)
server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
print(f"Local preview: http://127.0.0.1:{args.port}/", flush=True)
server.serve_forever()

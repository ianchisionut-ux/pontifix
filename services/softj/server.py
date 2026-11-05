"""Private HTTP adapter for the ANAF DUKIntegrator command line tool."""

import base64
import json
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore


ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor"
ALLOWED_TYPES = {"D112", "D300", "D390", "D394"}
MAX_REQUEST_BYTES = 4 * 1024 * 1024
JOBS = BoundedSemaphore(2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        # Declaration contents and personal data must never enter access logs.
        pass

    def reply(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path != "/health":
            self.reply(404, {"error": "Not found"})
            return
        ready = (VENDOR / "DUKIntegrator.jar").is_file() and all(
            (VENDOR / "lib" / f"{code}Validator.jar").is_file()
            and (VENDOR / "lib" / f"{code}Pdf.jar").is_file()
            for code in ALLOWED_TYPES
        )
        self.reply(200 if ready else 503, {"ready": ready})

    def do_POST(self):
        if self.path != "/render":
            self.reply(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_REQUEST_BYTES:
            self.reply(413, {"error": "Declarația depășește limita serviciului."})
            return
        try:
            body = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            self.reply(400, {"error": "Cerere JSON invalidă."})
            return
        if not isinstance(body, dict):
            self.reply(400, {"error": "Cerere JSON invalidă."})
            return
        code, mode, xml = body.get("type"), body.get("mode"), body.get("xml")
        if code not in ALLOWED_TYPES or mode not in {"validate", "pdf"} or not isinstance(xml, str) or not xml.lstrip().startswith("<"):
            self.reply(400, {"error": "Tip, mod sau XML invalid."})
            return
        if not JOBS.acquire(blocking=False):
            self.reply(503, {"error": "Serviciul este ocupat. Reîncearcă în câteva secunde."})
            return
        try:
            with tempfile.TemporaryDirectory(prefix="softj-") as directory:
                work = Path(directory)
                xml_file, err_file, pdf_file = work / "declaratie.xml", work / "rezultat.txt", work / "declaratie.pdf"
                xml_file.write_text(xml, encoding="utf-8")
                command = ["java", "-Djava.awt.headless=true", "-jar", str(VENDOR / "DUKIntegrator.jar")]
                if mode == "validate":
                    command += ["-v", code, str(xml_file), str(err_file)]
                else:
                    command += ["-p", code, str(xml_file), str(err_file), "0", "0", str(pdf_file)]
                try:
                    completed = subprocess.run(command, cwd=VENDOR, capture_output=True, timeout=45, check=False)
                except subprocess.TimeoutExpired:
                    self.reply(504, {"error": "Validarea Soft J a depășit timpul permis."})
                    return
                output = err_file.read_text(encoding="utf-8", errors="replace").strip() if err_file.exists() else ""
                output = output.replace(str(xml_file), "declaratie.xml")[:16000]
                if mode == "pdf" and completed.returncode == 0 and pdf_file.is_file() and pdf_file.stat().st_size > 0 and output.lower() in {"", "ok"}:
                    self.reply(200, {"ok": True, "pdfBase64": base64.b64encode(pdf_file.read_bytes()).decode("ascii")})
                elif mode == "validate" and completed.returncode == 0 and output.lower() == "ok":
                    self.reply(200, {"ok": True, "message": "XML validat de Soft J ANAF."})
                else:
                    diagnostic = (completed.stderr or completed.stdout).decode("utf-8", errors="replace").strip()[:1200]
                    self.reply(422, {"ok": False, "error": output or diagnostic or "Soft J nu a putut valida declarația.", "exitCode": completed.returncode})
        except OSError:
            self.reply(500, {"error": "Serviciul Soft J nu a putut procesa declarația."})
        finally:
            JOBS.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "3000"))), Handler).serve_forever()

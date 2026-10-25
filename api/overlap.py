"""Vercel Serverless Function for AICTE Overlap Engine."""
from http.server import BaseHTTPRequestHandler
import json
import sys
import os
from pathlib import Path

# Ensure overlap-engine src is importable
BASE_DIR = Path(__file__).resolve().parent.parent
ENGINE_SRC = BASE_DIR / "overlap-engine" / "src"
ENGINE_ROOT = BASE_DIR / "overlap-engine"
for p in (str(ENGINE_SRC), str(ENGINE_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from sync_service import run_overlap_sync
except ImportError:
    run_overlap_sync = None


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        if run_overlap_sync:
            try:
                result = run_overlap_sync()
                self.wfile.write(json.dumps(result).encode("utf-8"))
                return
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e), "alerts": []}).encode("utf-8"))
                return

        # Fallback if engine cannot run
        self.wfile.write(json.dumps({"alerts": [], "status": "engine_unavailable"}).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

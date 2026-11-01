"""Keep-alive for Render free web services.

Render spins down a free web service after 15 minutes without inbound traffic.
This module starts a background thread that pings this service's /health
endpoint every KEEP_ALIVE_INTERVAL seconds (default 600 = 10 minutes), so the
gap between requests never reaches 15 minutes.

Setup:
  1. Put this file next to app.py (public backend) or in backend/ (beta).
  2. Call start_keep_alive() once after the Flask app is created.
  3. Set KEEP_ALIVE_URL on the Render service, e.g.
     https://justtalk-1o-1.onrender.com
     (RENDER_EXTERNAL_URL is used automatically if it is set and KEEP_ALIVE_URL is not.)
"""

import logging
import os
import threading
import time
import urllib.request

log = logging.getLogger("keep_alive")


def start_keep_alive():
    """Start the background ping thread. Does nothing if no URL is configured."""
    base = os.getenv("KEEP_ALIVE_URL") or os.getenv("RENDER_EXTERNAL_URL")
    if not base:
        log.info("Keep-alive disabled: set KEEP_ALIVE_URL (or RENDER_EXTERNAL_URL).")
        return

    url = base.rstrip("/") + "/health"
    interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "600"))

    def loop():
        while True:
            time.sleep(interval)
            try:
                with urllib.request.urlopen(url, timeout=30) as resp:
                    log.info("keep-alive ping %s -> %s", url, resp.status)
            except Exception as exc:  # never let the thread die
                log.warning("keep-alive ping failed: %s", exc)

    threading.Thread(target=loop, name="keep-alive", daemon=True).start()
    log.info("Keep-alive started: pinging %s every %ss", url, interval)

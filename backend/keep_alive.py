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
import threading
import time
import urllib.request

URL = "https://justtalk-1o-1.onrender.com/health"


def start_keep_alive():
    def ping_forever():
        while True:
            time.sleep(600)  # 10 minutes
            try:
                urllib.request.urlopen(URL, timeout=30)
            except Exception:
                pass

    threading.Thread(target=ping_forever, daemon=True).start()

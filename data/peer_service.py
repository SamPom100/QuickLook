import json
import requests
import re
from typing import List, Optional

FINNHUB_TOKEN = "YOUR_FINNHUB_TOKEN_000000000000000000000"


class FinnhubPeerService:
    """Dynamic Finnhub Competitor Benchmark Service with 100% SQLite Caching."""

    @staticmethod
    def get_dynamic_peers(ticker: str, cache_manager=None) -> List[str]:
        ticker_upper = ticker.upper()
        url = f"https://finnhub.io/api/v1/stock/peers?symbol={ticker_upper}&token={FINNHUB_TOKEN}"

        raw_peers = None

        # 1. Check SQLite Disk Cache
        if cache_manager:
            cached = cache_manager.get_url_cache(url)
            if cached:
                raw_peers = json.loads(cached) if isinstance(cached, str) else cached

        # 2. Live Finnhub API Fetch if not in cache
        if not raw_peers:
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    raw_peers = resp.json()
                    if isinstance(raw_peers, list) and len(raw_peers) > 0:
                        if cache_manager:
                            cache_manager.save_url_cache(url, json.dumps(raw_peers))
            except Exception as e:
                print(f"Finnhub Peer Fetch Warning for {ticker_upper}: {e}")

        # 3. Clean and filter peer symbols (keep clean 1-5 letter symbols, filter self)
        filtered_peers = []
        if isinstance(raw_peers, list):
            for p in raw_peers:
                p_sym = str(p).upper().strip()
                # Exclude target ticker, micro OTC suffixes (.V, .CN, .H), and non-standard tickers
                if p_sym != ticker_upper and re.match(r"^[A-Z]{1,5}$", p_sym):
                    filtered_peers.append(p_sym)

        # Fallback to major industry benchmarks if fewer than 3 clean peers
        if len(filtered_peers) < 3:
            defaults = ["MSFT", "AAPL", "GOOGL", "AMZN", "NVDA"]
            for d in defaults:
                if d != ticker_upper and d not in filtered_peers:
                    filtered_peers.append(d)

        return filtered_peers[:4]

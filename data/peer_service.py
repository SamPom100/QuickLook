import json
import requests
import re
from typing import List, Optional
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor
from config import FINNHUB_TOKEN


class FinnhubPeerService:
    """Dynamic Finnhub Competitor Benchmark Service sorted by Market Cap relevance."""

    @staticmethod
    def get_market_cap(p_sym: str) -> float:
        try:
            t = yf.Ticker(p_sym)
            mc = t.fast_info.market_cap or 0.0
            return float(mc)
        except Exception:
            return 0.0

    @classmethod
    def get_dynamic_peers(cls, ticker: str, cache_manager=None) -> List[str]:
        ticker_upper = ticker.upper()
        cache_key = f"resolved_peers:{ticker_upper}"

        # 1. Check if final resolved sorted peer list is cached in SQLite
        if cache_manager:
            cached = cache_manager.get_url_cache(cache_key)
            if cached and isinstance(cached, list) and len(cached) > 0:
                print(f"  ⚡ [CACHE HIT] Finnhub: Competitor Peers ({ticker_upper})")
                return cached

        # 2. Check raw Finnhub response cache
        raw_cache_key = f"https://finnhub.io/api/v1/stock/peers?symbol={ticker_upper}"
        url = f"https://finnhub.io/api/v1/stock/peers?symbol={ticker_upper}&token={FINNHUB_TOKEN}"
        raw_peers = None
        if cache_manager:
            cached_raw = cache_manager.get_url_cache(raw_cache_key) or cache_manager.get_url_cache(url)
            if cached_raw:
                raw_peers = cached_raw

        # 3. Live Finnhub API Fetch if not in cache
        if not raw_peers and FINNHUB_TOKEN:
            print(f"  🌐 [LIVE API CALL] Finnhub: Competitor Peers ({ticker_upper})")
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    raw_peers = resp.json()
                    if isinstance(raw_peers, list) and len(raw_peers) > 0:
                        if cache_manager:
                            cache_manager.save_url_cache(raw_cache_key, raw_peers)
                            print(f"  💾 [CACHE SAVED] Finnhub: Competitor Peers ({ticker_upper})")
            except Exception as e:
                print(f"  ⚠️ [API ERROR] Finnhub Peer Fetch for {ticker_upper}: {e}")

        # 4. Clean and filter peer symbols
        filtered_peers = []
        if isinstance(raw_peers, list):
            for p in raw_peers:
                p_sym = str(p).upper().strip()
                if p_sym != ticker_upper and re.match(r"^[A-Z]{1,5}$", p_sym):
                    filtered_peers.append(p_sym)

        # Fallback to major industry benchmarks if fewer than 3 clean peers
        if len(filtered_peers) < 3:
            defaults = ["MSFT", "AAPL", "GOOGL", "AMZN", "NVDA"]
            for d in defaults:
                if d != ticker_upper and d not in filtered_peers:
                    filtered_peers.append(d)

        # 5. Sort Candidate Peers by Market Capitalization (Descending) for maximum relevance
        try:
            with ThreadPoolExecutor(max_workers=min(len(filtered_peers), 10)) as executor:
                mc_map = dict(zip(filtered_peers, executor.map(cls.get_market_cap, filtered_peers)))
            filtered_peers = sorted(filtered_peers, key=lambda s: mc_map.get(s, 0.0), reverse=True)
        except Exception:
            pass

        final_peers = filtered_peers[:4]
        if cache_manager and len(final_peers) > 0:
            cache_manager.save_url_cache(cache_key, final_peers)

        return final_peers

import re
from typing import List, Optional
import yfinance as yf
from yfinance import Industry
from concurrent.futures import ThreadPoolExecutor


class PeerService:
    """Dynamic Competitor Benchmark Service powered 100% by Yahoo Finance with zero API keys."""

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
        cache_key = f"resolved_peers_yf_v1:{ticker_upper}"

        # 1. Check SQLite disk cache
        if cache_manager:
            cached = cache_manager.get_url_cache(cache_key)
            if cached and isinstance(cached, list) and len(cached) > 0:
                print(f"  ⚡ [CACHE HIT] Competitor Peers ({ticker_upper})")
                return cached

        print(f"  🌐 [LIVE API CALL] Yahoo Finance: Competitor Peers ({ticker_upper})")
        candidates = []

        # 2. Query Yahoo Finance Industry constituents
        try:
            t = yf.Ticker(ticker_upper)
            info = t.info or {}
            ind_key = info.get("industryKey")
            
            if ind_key:
                ind = Industry(ind_key)
                if hasattr(ind, "top_companies") and ind.top_companies is not None and not ind.top_companies.empty:
                    top_list = [
                        str(s).upper().strip()
                        for s in list(ind.top_companies.index)
                        if str(s).upper().strip() != ticker_upper and re.match(r"^[A-Z]{1,5}$", str(s).upper().strip())
                    ]
                    candidates.extend(top_list[:8])
        except Exception as e:
            print(f"  ⚠️ [PEER SERVICE] Error fetching industry constituents for {ticker_upper}: {e}")

        # 3. Fallbacks for mega-caps with few direct US industry peers (e.g. AAPL)
        if len(candidates) < 3 or (ticker_upper in ["AAPL", "GOOGL", "GOOG"]):
            mega_defaults = ["MSFT", "NVDA", "GOOGL", "AMZN", "META", "AAPL"]
            for m in mega_defaults:
                if m != ticker_upper and m not in candidates:
                    candidates.append(m)

        # 4. Sort by Market Capitalization descending to ensure the most relevant direct competitors
        try:
            with ThreadPoolExecutor(max_workers=min(len(candidates), 8)) as executor:
                mc_map = dict(zip(candidates, executor.map(cls.get_market_cap, candidates)))
            candidates = sorted(candidates, key=lambda s: mc_map.get(s, 0.0), reverse=True)
        except Exception:
            pass

        final_peers = candidates[:4]
        if not final_peers:
            final_peers = [s for s in ["MSFT", "NVDA", "AMZN", "GOOGL"] if s != ticker_upper][:4]

        # 5. Cache permanently in SQLite
        if cache_manager and len(final_peers) > 0:
            cache_manager.save_url_cache(cache_key, final_peers)

        return final_peers




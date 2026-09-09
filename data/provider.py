import time
import requests
from typing import List, Optional, Dict, Any
import pandas as pd
import yfinance as yf
from .models import CompanyOverview, FinancialStatement
from .ratio_engine import RatioEngine
from .cache_manager import CacheManager
from config import ALPHAVANTAGE_KEY


class FinancialDataProvider:
    """
    Standardized Alpha Vantage Data Provider with resilient caching and rate limiting.
    """

    def __init__(self, api_key: Optional[str] = None, cache_manager: Optional[CacheManager] = None):
        self.api_key = api_key or ALPHAVANTAGE_KEY
        self.cache = cache_manager or CacheManager()

    def _fetch_url(self, url: str, label: str = "") -> Dict[str, Any]:
        """
        Fetch JSON from URL with 100% disk caching.
        If URL exists in SQLite disk cache, returns instantly with zero network call.
        """
        tag = label or url.split("&apikey=")[0]
        cache_key = url.split("&apikey=")[0].split("&token=")[0]
        cached = self.cache.get_url_cache(cache_key) or self.cache.get_url_cache(url)
        if cached:
            print(f"  ⚡ [CACHE HIT] {tag}")
            return cached

        print(f"  🌐 [LIVE API CALL] {tag}")
        try:
            # Throttle live requests to comply with Alpha Vantage free tier rate limit
            time.sleep(1.2)
            r = requests.get(url, timeout=12)
            data = r.json()
            
            # Check for Alpha Vantage rate limit message
            if isinstance(data, dict) and ("Information" in data or "Note" in data):
                print(f"  ⏳ [THROTTLED] Alpha Vantage rate limit reached for {tag}")
                self.was_throttled = True
            
            # Cache valid responses permanently to disk
            if data and "Error Message" not in data and "Information" not in data and "Note" not in data:
                self.cache.save_url_cache(cache_key, data)
                print(f"  💾 [CACHE SAVED] {tag}")
            return data
        except Exception as e:
            print(f"  ⚠️ [API ERROR] AlphaVantage Fetch Warning for {tag}: {e}")
            return {}

    def get_company_overview(self, ticker: str) -> CompanyOverview:
        cached_info = self.cache.get_company_info(ticker)
        if cached_info:
            print(f"  ⚡ [CACHE HIT] Company Overview ({ticker.upper()})")
            return CompanyOverview(**cached_info)

        url = f"https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker.upper()}&apikey={self.api_key}"
        data = self._fetch_url(url, label=f"Alpha Vantage: OVERVIEW ({ticker.upper()})")
        if data and isinstance(data, dict) and "Name" in data:
            def safe_float(v):
                try: return float(v) if v and v != "None" else None
                except: return None
            overview = CompanyOverview(
                ticker=ticker.upper(),
                name=data.get("Name") or ticker.upper(),
                sector=data.get("Sector"),
                industry=data.get("Industry"),
                market_cap=safe_float(data.get("MarketCapitalization")),
                shares_outstanding=safe_float(data.get("SharesOutstanding")),
                currency=data.get("Currency", "USD"),
                summary=data.get("Description"),
            )
            self.cache.save_company_info(ticker, overview.model_dump())
            print(f"  💾 [CACHE SAVED] Company Overview ({ticker.upper()})")
            return overview

        # Fallback to yfinance if Alpha Vantage overview is rate limited
        try:
            print(f"  🌐 [LIVE API CALL] Yahoo Finance: Company Info ({ticker.upper()})")
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info or {}
            overview = CompanyOverview(
                ticker=ticker.upper(),
                name=info.get("longName") or info.get("shortName") or ticker.upper(),
                sector=info.get("sector"),
                industry=info.get("industry"),
                market_cap=info.get("marketCap"),
                shares_outstanding=info.get("sharesOutstanding"),
                currency=info.get("currency", "USD"),
                summary=info.get("longBusinessSummary"),
            )
            self.cache.save_company_info(ticker, overview.model_dump())
            print(f"  💾 [CACHE SAVED] Company Overview ({ticker.upper()})")
            return overview
        except Exception:
            return CompanyOverview(ticker=ticker.upper(), name=ticker.upper())

    def get_financial_statements(
        self, ticker: str, period: str = "quarterly"
    ) -> List[FinancialStatement]:
        cached_stmt = self.cache.get_financial_statements(ticker, "av_quarterly_v3")
        if cached_stmt:
            print(f"  ⚡ [CACHE HIT] Financial Statements ({ticker.upper()}, {period})")
            return [FinancialStatement(**s) for s in cached_stmt]

        try:
            from concurrent.futures import ThreadPoolExecutor

            inc_url = f"https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol={ticker.upper()}&apikey={self.api_key}"
            cf_url = f"https://www.alphavantage.co/query?function=CASH_FLOW&symbol={ticker.upper()}&apikey={self.api_key}"

            # Fetch Income Statement and Cash Flow in parallel!
            with ThreadPoolExecutor(max_workers=2) as executor:
                f_inc = executor.submit(self._fetch_url, inc_url, f"Alpha Vantage: INCOME_STATEMENT ({ticker.upper()})")
                f_cf = executor.submit(self._fetch_url, cf_url, f"Alpha Vantage: CASH_FLOW ({ticker.upper()})")
                inc_data = f_inc.result()
                cf_data = f_cf.result()

            inc_reports = inc_data.get("quarterlyReports", []) if isinstance(inc_data, dict) else []
            cf_reports = cf_data.get("quarterlyReports", []) if isinstance(cf_data, dict) else []

            cf_map = {
                r.get("fiscalDateEnding"): r for r in cf_reports if r.get("fiscalDateEnding")
            }

            statements: List[FinancialStatement] = []
            for inc in inc_reports:
                date_str = inc.get("fiscalDateEnding")
                if not date_str:
                    continue

                def safe_float(val):
                    try:
                        return float(val) if val and val != "None" else None
                    except Exception:
                        return None

                rev_val = safe_float(inc.get("totalRevenue"))
                gross_val = safe_float(inc.get("grossProfit"))
                net_val = safe_float(inc.get("netIncome"))
                op_inc_val = safe_float(inc.get("operatingIncome"))

                cf_item = cf_map.get(date_str, {})
                opcf_val = safe_float(cf_item.get("operatingCashflow"))
                capex_val = safe_float(cf_item.get("capitalExpenditures"))

                fcf_val = None
                if opcf_val is not None and capex_val is not None:
                    fcf_val = RatioEngine.calculate_free_cash_flow(opcf_val, capex_val)

                stmt = FinancialStatement(
                    period_end_date=str(date_str),
                    period_type="quarterly",
                    revenue=rev_val,
                    gross_profit=gross_val,
                    net_income=net_val,
                    operating_cash_flow=opcf_val,
                    capital_expenditure=capex_val,
                    free_cash_flow=fcf_val,
                    operating_income=op_inc_val,
                )
                statements.append(stmt)

            # Sort chronologically (oldest to newest)
            statements = sorted(statements, key=lambda s: s.period_end_date)

            # Keep last 40 quarters (10 full years)
            if len(statements) > 40:
                statements = statements[-40:]

            if len(statements) > 0:
                self.cache.save_financial_statements(
                    ticker, "av_quarterly_v3", [s.model_dump() for s in statements]
                )
                print(f"  💾 [CACHE SAVED] Financial Statements ({ticker.upper()}, {len(statements)} quarters)")
                return statements

        except Exception as e:
            print(f"  ⚠️ [ERROR] AlphaVantage Provider Warning for {ticker.upper()}: {e}")

        return []

    def get_price_history(self, ticker: str, period: str = "10y") -> pd.DataFrame:
        cached_df = self.cache.get_price_history(ticker, period)
        if cached_df is not None:
            print(f"  ⚡ [CACHE HIT] Price History ({ticker.upper()}, {period})")
            return cached_df

        print(f"  🌐 [LIVE API CALL] Yahoo Finance: Price History ({ticker.upper()}, {period})")
        yf_ticker = yf.Ticker(ticker)
        df = yf_ticker.history(period=period)
        if not df.empty:
            df.index = df.index.astype(str)
            self.cache.save_price_history(ticker, period, df)
            print(f"  💾 [CACHE SAVED] Price History ({ticker.upper()}, {period})")
        return df

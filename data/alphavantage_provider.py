import yfinance as yf
import requests
from typing import List, Optional, Dict, Any
import pandas as pd
from .base_provider import BaseDataProvider
from .models import CompanyOverview, FinancialStatement
from .ratio_engine import RatioEngine
from .cache_manager import CacheManager


class AlphaVantageProvider(BaseDataProvider):
    """
    Alpha Vantage Data Provider using user's API key.
    100% URL Caching: Caches every raw HTTP request to Alpha Vantage in SQLite
    so repeat calls NEVER consume API quota.
    """

    def __init__(self, api_key: str = "YOUR_ALPHA_KEY_0", cache_manager: Optional[CacheManager] = None):
        self.api_key = api_key
        self.cache = cache_manager or CacheManager()

    def _fetch_url(self, url: str, label: str = "") -> Dict[str, Any]:
        """
        Fetch JSON from URL with 100% SQLite caching.
        If URL was fetched before, returns cached JSON instantly without network call.
        """
        tag = label or url.split("&apikey=")[0]
        cached = self.cache.get_url_cache(url)
        if cached:
            print(f"  ⚡ [CACHE HIT] {tag}")
            return cached

        print(f"  🌐 [LIVE API CALL] {tag}")
        try:
            r = requests.get(url, timeout=10)
            data = r.json()
            if isinstance(data, dict) and ("Information" in data or "Note" in data):
                print(f"  ⏳ [THROTTLED] Alpha Vantage rate limit reached for {tag}")
            # Only cache valid responses (not rate-limit messages or errors)
            if data and "Error Message" not in data and "Information" not in data and "Note" not in data:
                self.cache.save_url_cache(url, data)
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

    def get_financial_statements(
        self, ticker: str, period: str = "quarterly"
    ) -> List[FinancialStatement]:
        cached_stmt = self.cache.get_financial_statements(ticker, "av_quarterly_v2")
        if cached_stmt:
            print(f"  ⚡ [CACHE HIT] Financial Statements ({ticker.upper()}, {period})")
            return [FinancialStatement(**s) for s in cached_stmt]

        try:
            # 1. Fetch Standardized Quarterly Income Statement (Cached URL Call)
            inc_url = f"https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol={ticker.upper()}&apikey={self.api_key}"
            inc_data = self._fetch_url(inc_url, label=f"Alpha Vantage: INCOME_STATEMENT ({ticker.upper()})")
            inc_reports = inc_data.get("quarterlyReports", [])

            # 2. Fetch Standardized Quarterly Cash Flow Statement (Cached URL Call)
            cf_url = f"https://www.alphavantage.co/query?function=CASH_FLOW&symbol={ticker.upper()}&apikey={self.api_key}"
            cf_data = self._fetch_url(cf_url, label=f"Alpha Vantage: CASH_FLOW ({ticker.upper()})")
            cf_reports = cf_data.get("quarterlyReports", [])

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
                    ticker, "av_quarterly_v2", [s.model_dump() for s in statements]
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

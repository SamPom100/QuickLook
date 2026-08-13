from typing import List, Dict, Any, Optional
import pandas as pd
from .base_provider import BaseDataProvider
from .provider import FinancialDataProvider
from .ratio_engine import RatioEngine
from .models import CompanyOverview, FinancialStatement, MetricPoint


class FinancialDataService:
    """High-level facade service providing analyzed financial data to the application layer."""

    def __init__(self, provider: Optional[BaseDataProvider] = None):
        self.provider = provider or FinancialDataProvider()

    def get_company_summary(self, ticker: str) -> CompanyOverview:
        """Fetch general company overview."""
        return self.provider.get_company_overview(ticker)

    def get_financial_analysis(
        self, ticker: str, period: str = "quarterly"
    ) -> List[Dict[str, Any]]:
        """
        Fetch quarterly financial statements enriched with Free Cash Flow and growth metrics.
        Returns a list of dicts sorted chronologically (oldest to newest).
        """
        raw_statements = self.provider.get_financial_statements(ticker, period)
        analyzed = RatioEngine.compute_statement_ratios(raw_statements)
        return analyzed

    def get_valuation_history(
        self, ticker: str, period: str = "10y"
    ) -> pd.DataFrame:
        """
        Fetch price history enriched with split-safe P/E and market cap.
        """
        overview = self.get_company_summary(ticker)
        statements = self.provider.get_financial_statements(ticker, "quarterly")

        net_inc_dict = {
            s.period_end_date: s.net_income
            for s in statements
            if s.net_income is not None
        }
        net_inc_series = pd.Series(net_inc_dict)

        price_df = self.provider.get_price_history(ticker, period)
        if price_df.empty:
            return price_df

        price_df.index = pd.to_datetime(price_df.index, utc=True).tz_localize(None)

        enriched_df = RatioEngine.calculate_historical_pe_ratio(
            price_df, net_inc_series, shares_outstanding=overview.shares_outstanding
        )
        return enriched_df

    def get_metric_time_series(
        self, ticker: str, metric_name: str, period: str = "quarterly"
    ) -> List[MetricPoint]:
        analysis = self.get_financial_analysis(ticker, period)
        points = []
        for stmt in analysis:
            date_val = stmt.get("period_end_date")
            val = stmt.get(metric_name)
            points.append(MetricPoint(date=str(date_val), label=metric_name, value=val))
        return points

from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from .models import FinancialStatement, ValuationMetrics


class RatioEngine:
    """Core analytics engine for calculating financial ratios and growth metrics."""

    @staticmethod
    def calculate_free_cash_flow(
        operating_cash_flow: Optional[float], capital_expenditure: Optional[float]
    ) -> Optional[float]:
        """
        Calculate Free Cash Flow = Operating Cash Flow - |Capital Expenditure|
        """
        if operating_cash_flow is None or capital_expenditure is None:
            return None
        # Capital expenditure is often reported as negative in cash flow statements
        capex_abs = abs(capital_expenditure)
        return operating_cash_flow - capex_abs

    @staticmethod
    def compute_statement_ratios(
        statements: List[FinancialStatement],
    ) -> List[Dict[str, Any]]:
        """
        Calculates profit margins, FCF margins, and YoY growth percentages for statements.
        Expects statements to be ordered chronologically (oldest to newest).
        """
        sorted_statements = sorted(
            statements, key=lambda s: s.period_end_date
        )

        results = []
        for i, s in enumerate(sorted_statements):
            item = s.model_dump()

            # 1. Ensure Free Cash Flow is computed
            if item.get("free_cash_flow") is None:
                item["free_cash_flow"] = RatioEngine.calculate_free_cash_flow(
                    item.get("operating_cash_flow"), item.get("capital_expenditure")
                )

            rev = item.get("revenue")
            net_inc = item.get("net_income")
            gross = item.get("gross_profit")
            fcf = item.get("free_cash_flow")

            # 2. Margins
            item["gross_margin_pct"] = (
                (gross / rev * 100) if (rev and gross and rev != 0) else None
            )
            item["net_margin_pct"] = (
                (net_inc / rev * 100) if (rev and net_inc and rev != 0) else None
            )
            item["fcf_margin_pct"] = (
                (fcf / rev * 100) if (rev and fcf and rev != 0) else None
            )

            # 3. YoY Growth Metrics
            if i > 0:
                prev = sorted_statements[i - 1]
                prev_rev = prev.revenue
                prev_net = prev.net_income
                prev_fcf = prev.free_cash_flow

                item["yoy_revenue_growth_pct"] = (
                    ((rev - prev_rev) / abs(prev_rev) * 100)
                    if (rev is not None and prev_rev and prev_rev != 0)
                    else None
                )
                item["yoy_net_income_growth_pct"] = (
                    ((net_inc - prev_net) / abs(prev_net) * 100)
                    if (net_inc is not None and prev_net and prev_net != 0)
                    else None
                )
                item["yoy_fcf_growth_pct"] = (
                    ((fcf - prev_fcf) / abs(prev_fcf) * 100)
                    if (fcf is not None and prev_fcf and prev_fcf != 0)
                    else None
                )
            else:
                item["yoy_revenue_growth_pct"] = None
                item["yoy_net_income_growth_pct"] = None
                item["yoy_fcf_growth_pct"] = None

            results.append(item)

        return results

    @staticmethod
    def calculate_historical_pe_ratio(
        price_df: pd.DataFrame,
        net_income_series: pd.Series,
        shares_outstanding: Optional[int] = None,
    ) -> pd.DataFrame:
        """
        Calculates split-safe historical P/E ratios.
        Uses Market Cap / Net Income or Adjusted Close / Split-Adjusted EPS.
        """
        df = price_df.copy()
        if "Close" not in df.columns:
            return df

        # If shares outstanding is available, calculate Market Cap / Net Income
        # Net income series should have DatetimeIndex matching statement period dates
        df["P/E"] = np.nan
        df["Market_Cap"] = np.nan

        if shares_outstanding and not net_income_series.empty:
            df["Market_Cap"] = df["Close"] * shares_outstanding
            # Align net income to price dates using backward fill or merge asof
            net_inc_df = pd.DataFrame(
                {"Net_Income": net_income_series.values},
                index=pd.to_datetime(net_income_series.index),
            ).sort_index()

            df_sorted = df.sort_index()
            merged = pd.merge_asof(
                df_sorted,
                net_inc_df,
                left_index=True,
                right_index=True,
                direction="backward",
            )
            merged["P/E"] = np.where(
                merged["Net_Income"] > 0,
                merged["Market_Cap"] / merged["Net_Income"],
                np.nan,
            )
            return merged

        return df

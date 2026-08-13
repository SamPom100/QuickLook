from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class CompanyOverview(BaseModel):
    """General company metadata."""
    ticker: str
    name: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    shares_outstanding: Optional[int] = None
    currency: Optional[str] = "USD"
    summary: Optional[str] = None


class FinancialStatement(BaseModel):
    """Standardized financial statement metrics for a specific period."""
    period_end_date: str
    period_type: str = "annual"  # 'annual' or 'quarterly'
    revenue: Optional[float] = None
    cost_of_revenue: Optional[float] = None
    gross_profit: Optional[float] = None
    net_income: Optional[float] = None
    operating_cash_flow: Optional[float] = None
    capital_expenditure: Optional[float] = None
    free_cash_flow: Optional[float] = None  # Calculated: OCF - CapEx
    diluted_eps: Optional[float] = None
    operating_income: Optional[float] = None
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    shares_outstanding: Optional[float] = None


class ValuationMetrics(BaseModel):
    """Historical valuation metrics for a given date."""
    date: str
    close_price: float
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    ps_ratio: Optional[float] = None
    pfcf_ratio: Optional[float] = None


class MetricPoint(BaseModel):
    """Single metric time-series point."""
    date: str
    label: str
    value: Optional[float] = None

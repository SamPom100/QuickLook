import os
import pytest
import pandas as pd
from data.models import CompanyOverview, FinancialStatement
from data.ratio_engine import RatioEngine
from data.cache_manager import CacheManager
from data.data_service import FinancialDataService


def test_free_cash_flow_calculation():
    fcf = RatioEngine.calculate_free_cash_flow(100_000_000, -30_000_000)
    assert fcf == 70_000_000


def test_cache_manager(tmp_path):
    db_file = os.path.join(tmp_path, "test_cache.db")
    cache = CacheManager(db_path=db_file)

    overview_data = {"ticker": "AAPL", "name": "Apple Inc.", "market_cap": 3000000000000}
    cache.save_company_info("AAPL", overview_data)

    retrieved = cache.get_company_info("AAPL")
    assert retrieved is not None
    assert retrieved["name"] == "Apple Inc."


def test_live_data_service():
    service = FinancialDataService()
    summary = service.get_company_summary("AAPL")
    assert summary.ticker == "AAPL"

    analysis = service.get_financial_analysis("AAPL", period="quarterly")
    assert len(analysis) > 0
    latest = analysis[-1]
    assert "revenue" in latest
    assert "net_income" in latest
    assert "free_cash_flow" in latest
    assert "stock_based_compensation" in latest
    assert "real_fcf" in latest


def test_real_fcf_and_sbc_ratio():
    stmt = FinancialStatement(
        period_end_date="2026-06-30",
        revenue=100_000_000,
        operating_cash_flow=40_000_000,
        capital_expenditure=-10_000_000,
        stock_based_compensation=5_000_000,
    )
    res = RatioEngine.compute_statement_ratios([stmt])
    assert len(res) == 1
    item = res[0]
    assert item["free_cash_flow"] == 30_000_000
    assert item["real_fcf"] == 25_000_000
    assert item["real_fcf_margin_pct"] == 25.0
    assert item["sbc_pct_rev"] == 5.0


def test_api_advanced_metrics():
    from api import app
    with app.test_client() as client:
        res = client.get("/api/data/MSFT")
        assert res.status_code == 200
        data = res.get_json()
        kpis = data.get("kpis", {})
        assert "evEbitda" in kpis
        assert "netDebtLabel" in kpis
        assert "latestROIC" in kpis
        assert "ttmRealFCF" in kpis
        quarters = data.get("quarters", [])
        assert len(quarters) > 0
        latest_q = quarters[-1]
        assert "realFreeCashFlow" in latest_q
        assert "stockBasedCompensation" in latest_q
        assert "roic" in latest_q


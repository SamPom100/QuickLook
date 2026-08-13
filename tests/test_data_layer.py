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

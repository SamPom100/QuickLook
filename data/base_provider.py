from abc import ABC, abstractmethod
from typing import List, Optional
import pandas as pd
from .models import CompanyOverview, FinancialStatement


class BaseDataProvider(ABC):
    """Abstract Base Class for all financial data providers."""

    @abstractmethod
    def get_company_overview(self, ticker: str) -> CompanyOverview:
        pass

    @abstractmethod
    def get_financial_statements(
        self, ticker: str, period: str = "quarterly"
    ) -> List[FinancialStatement]:
        pass

    @abstractmethod
    def get_price_history(
        self, ticker: str, period: str = "10y"
    ) -> pd.DataFrame:
        pass

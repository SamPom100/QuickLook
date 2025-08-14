from sam_url_cache import URLCache
import os
from .parse import parse_table_helper

class DataSource:
    def __init__(self):
        database_path = os.path.dirname(__file__) + "/cache.db"
        self._url_cache = URLCache(database_path)

    def get_revenue(self, ticker: str):
        url = f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/revenue"
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed

    def get_net_income(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/net-income'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_ebita(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/ebitda'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_cash_flow(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/free-cash-flow'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
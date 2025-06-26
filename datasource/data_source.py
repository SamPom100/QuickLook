from cache import URLCache
from .parse_table import _parse_table_helper

class DataSource:
    def __init__(self) -> None:
        self.url_cache = URLCache()

    def get_revenue(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/revenue'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_gross_profit(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/gross-profit'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_operating_income(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/operating-income'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_ebita(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/ebitda'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_net_income(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/net-income'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result

    def get_eps(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/eps-earnings-per-share-diluted'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_shares_outstanding(self, ticker: str) -> list[tuple[str, str]]:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/shares-outstanding'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    



    

from sam_url_cache import URLCache
import os
from bs4 import BeautifulSoup as bs
import numpy as np
import matplotlib.pyplot as plt

def _convert_to_whole_number(revenue_str: str) -> int:
    clean_str = revenue_str.replace('$', '').replace(',', '')
    
    if 'B' in clean_str:
        return int(float(clean_str.replace('B', '')) * 1_000_000_000)
    elif 'M' in clean_str:
        return int(float(clean_str.replace('M', '')) * 1_000_000)
    else:
        return int(float(clean_str) * 1_000_000)


def plot_financial_data(net_income_data, ebida_data, revenue_data):
    net_income_data = net_income_data[::-1]
    revenue_data = revenue_data[::-1]
    ebida_data = ebida_data[::-1]
    
    net_income = [int(item['data']) for item in net_income_data]
    ebida = [int(item['data']) for item in ebida_data]
    revenue = [int(item['data']) for item in revenue_data]
    dates = [item['date'] for item in net_income_data]
    
    x = np.arange(len(revenue))
    plt.bar(x, revenue, color="#1f77b4", alpha=0.9, label='Revenue')
    plt.bar(x, ebida, color="#ff7f0e", alpha=0.7, label='EBITDA')
    plt.bar(x, net_income, color="#2ca02c", alpha=0.5, label='Net Income')
    plt.xticks(x, dates, rotation=90)
    plt.legend()
    plt.tight_layout()
    plt.show()


class DataSource:
    def __init__(self):
        database_path = os.path.dirname(__file__) + "/cache.db"
        self._url_cache = URLCache(database_path)

    def get_revenue(self, ticker: str):
        url = f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/revenue"
        url_result = self._url_cache.get_url(url)
        url_parsed = self._parse_table_helper(url_result, url)
        return url_parsed

    def get_net_income(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/net-income'
        url_result = self._url_cache.get_url(url)
        url_parsed = self._parse_table_helper(url_result, url)
        return url_parsed
    
    def get_ebita(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/ebitda'
        url_result = self._url_cache.get_url(url)
        url_parsed = self._parse_table_helper(url_result, url)
        return url_parsed
    
    def get_cash_flow(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/free-cash-flow'
        url_result = self._url_cache.get_url(url)
        url_parsed = self._parse_table_helper(url_result, url)
        return url_parsed
    






















    def _parse_table_helper(self, blob: str, url: str) -> str:
        try:
            soup = bs(blob, "html.parser")
            tables = soup.find_all("table", class_ = "historical_data_table table")

            annual_revenue = tables[0]
            quarterly_revenue = tables[1]
            quarterly_revenue_rows = quarterly_revenue.find_all("tr")[1:]

            data = []
            for quarterly_row in quarterly_revenue_rows:
                quarterly_cell = quarterly_row.find_all("td")
                date = quarterly_cell[0].get_text(strip = True)
                revenue = quarterly_cell[1].get_text(strip=True).replace("$", "").replace(",", "")
                data.append({"date": date, "data": revenue})
            return data
        except:
            print("Error parsing table data")
            self._url_cache.delete_url(url)
            return []







s = DataSource()
net_income = s.get_net_income("MSFT")
revenue = s.get_revenue("MSFT")
ebita = s.get_ebita("MSFT")

plot_financial_data(net_income, ebita, revenue)
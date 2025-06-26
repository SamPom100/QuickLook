from bs4 import BeautifulSoup as bs

def _parse_table_helper(blob: str) -> list[tuple[str, str]]:
    soup = bs(blob, "html.parser")
    table = soup.find_all("table", class_ = "historical_data_table table")
    _annual_revenue = table[0]
    quarterly_revenue = table[1]
    rows = quarterly_revenue.find_all("tr")[1:]
    data = [tuple(i.text for i in row.find_all('td')) for row in rows]
    data = sorted(data, key=lambda x: x[0], reverse=True)
    return data
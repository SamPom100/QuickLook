from bs4 import BeautifulSoup as bs
import json

def _parse_table_helper(blob: str) -> str:
    soup = bs(blob, "html.parser")
    tables = soup.find_all("table", class_ = "historical_data_table table")

    annual_revenue = tables[0]
    quarterly_revenue = tables[1]
    quarterly_revenue_rows = quarterly_revenue.find_all("tr")[1:]

    data = []
    for quarterly_row in quarterly_revenue_rows:
        quarterly_cell = quarterly_row.find_all("td")
        date = quarterly_cell[0].get_text(strip = True)
        revenue = quarterly_cell[1].get_text(strip = True)
        data.append({"date": date, "revenue": revenue})
    return json.dumps(data, indent = 2)

from bs4 import BeautifulSoup as bs
from datetime import datetime

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
        revenue = quarterly_cell[1].get_text(strip=True).replace("$", "").replace(",", "")
        data.append({"date": date, "data": revenue})
    return data

def _parse_pe_helper(blob: str):
    soup = bs(blob, 'html.parser')
    table = soup.find_all('table', class_='table')
    quarterly_pe_ratio = table[0]
    quarterly_pe_ratio_rows = quarterly_pe_ratio.find_all('tr')[2:]

    data = []
    for quarterly_row in quarterly_pe_ratio_rows:
        quarterly_cell = quarterly_row.find_all('td')
        date = quarterly_cell[0].get_text(strip=True)
        revenue = quarterly_cell[-1].get_text(strip=True)
        cleaned_revenue = revenue.replace(',', '').replace('$', '').replace('.00', '')
        data.append({"date": date, "data": cleaned_revenue})
    return data

def _mlq_parse_helper(blob: str) -> str:
    soup = bs(blob, "html.parser")
    table = soup.find_all("table", class_="table table-striped")[0]
    rows = table.find_all("tr")[1:] 

    data = []
    for row in rows:
        cells = row.find_all("td")
        raw_date = cells[0].get_text(strip=True)
        try:
            date = datetime.strptime(raw_date, "%B %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            date = raw_date

        ev = cells[1].get_text(strip=True).replace("$", "").replace(",", "").replace("T", "").replace("B", "").replace("M", "")
        stock_price = cells[3].get_text(strip=True).replace("$", "").replace(",", "")
        number_of_shares = cells[4].get_text(strip=True).replace(",", "").replace("T", "").replace("B", "").replace("M", "")
        market_cap = cells[5].get_text(strip=True).replace("$", "").replace(",", "").replace("T", "").replace("B", "").replace("M", "")
        cash = cells[6].get_text(strip=True).replace("$", "").replace(",", "").replace("T", "").replace("B", "").replace("M", "")
        debt = cells[7].get_text(strip=True).replace("$", "").replace(",", "").replace("-", "0").replace("T", "").replace("B", "").replace("M", "")

        data.append({
            "date": date,
            "ev": ev,
            "stock_price": stock_price,
            "number_of_shares": number_of_shares,
            "market_cap": market_cap,
            "cash": cash,
            "debt": debt
        })

    return data

if __name__ == "__main__":
    raise RuntimeError("Do not run this directly.")
from bs4 import BeautifulSoup as bs

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
        time_parts = quarterly_cell[0].get_text(strip=True).split('-')
        revenue = quarterly_cell[-1].get_text(strip=True)
        formatted_date = f'{time_parts[1]}-{time_parts[0]}'
        cleaned_revenue = revenue.replace(',', '').replace('$', '').replace('.00', '')
        data.append({"date": formatted_date, "data": cleaned_revenue})
    return data

if __name__ == "__main__":
    raise RuntimeError("Do not run this directly.")
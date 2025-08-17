from bs4 import BeautifulSoup as bs

def convert_to_whole_number(revenue_str: str) -> int:
    clean_str = revenue_str.replace('$', '').replace(',', '')
    
    if 'B' in clean_str:
        return int(float(clean_str.replace('B', '')) * 1_000_000_000)
    elif 'M' in clean_str:
        return int(float(clean_str.replace('M', '')) * 1_000_000)
    else:
        return int(float(clean_str) * 1_000_000)

def parse_table_helper(blob: str, url: str) -> list[dict[str, str]]:
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
            revenue = quarterly_cell[1].get_text(strip=True)
            if revenue == '' or revenue == 'N/A':
                continue
            revenue = convert_to_whole_number(revenue)
            data.append({"date": date, "data": revenue})
        return data
    except:
        raise ValueError(f"Failed to parse data from {url}. Please check the URL or the HTML structure.")
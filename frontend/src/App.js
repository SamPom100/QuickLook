import React, { useState } from "react";
import SearchBar from "./components/search_bar";
import ChartCard from "./components/chart_card";

const endpoints = [
  { key: "revenue", label: "Revenue" },
  { key: "gross-profit", label: "Gross Profit" },
  { key: "operating-income", label: "Operating Income" },
  { key: "ebitda", label: "EBITDA" },
  { key: "net-income", label: "Net Income" },
  { key: "cash-flow", label: "Cash Flow" },
  { key: "eps", label: "EPS" },
  { key: "shares-outstanding", label: "Shares Outstanding" },
  { key: "pe-ratio", label: "PE Ratio" },
];

function App() {
  const [ticker, setTicker] = useState(""); // Search box starts empty
  const [charts, setCharts] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e, initialTicker) => {
    if (e) e.preventDefault();
    setLoading(true);
    const newCharts = {};
    const searchTicker = (initialTicker !== undefined ? initialTicker : ticker).trim().toLowerCase();

    // Check if we've seen this ticker before
    let seenBefore = false;
    try {
      const seenRes = await fetch(`http://127.0.0.1:8000/seen-before/${searchTicker}`);
      if (seenRes.ok) {
        seenBefore = await seenRes.json();
      }
    } catch (err) {
      console.error("Error checking seen-before:", err);
    }

    // Helper to delay with jitter
    const delay = ms => new Promise(res => setTimeout(res, ms));

    for (const [i, endpoint] of endpoints.entries()) {
      // Only jitter if not seen before
      if (!seenBefore) {
        const jitter = Math.random() * 1800 + 400; // 400ms to 2200ms
        await delay(i * 300 + jitter);
      }

      console.log(`Fetching ${endpoint.key} for ${searchTicker}`);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/${endpoint.key}/${searchTicker}`
        );
        if (!res.ok) {
          const errorText = await res.text();
          console.error(
            `Error fetching ${endpoint.key} for ${searchTicker}: ${res.status} ${res.statusText} - ${errorText}`
          );
          throw new Error("No data");
        }
        const data = await res.json();
        console.log(`Received data for ${endpoint.key}:`, data);
        if (Array.isArray(data) && data.length && data[0].date) {
          const valueKey = Object.keys(data[0]).find(k => k !== "date");
          newCharts[endpoint.key] = {
            years: data.map(item => item.date),
            values: data.map(item => item[valueKey]),
          };
        } else {
          newCharts[endpoint.key] = data;
        }
      } catch (err) {
        console.error(
          `Failed to fetch ${endpoint.key} for ${searchTicker}:`,
          err
        );
        newCharts[endpoint.key] = null;
      }
    }
    setCharts(newCharts);
    setLoading(false);
  };

  // Only search for AAPL on mount, not on every keystroke
  React.useEffect(() => {
    handleSearch(null, "aapl");
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{
      maxWidth: 1400,
      margin: "24px auto",
      padding: 24,
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 2px 16px rgba(0,0,0,0.07)"
    }}>
      <SearchBar
        ticker={ticker}
        setTicker={setTicker}
        loading={loading}
        onSearch={handleSearch}
      />
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 32,
        justifyContent: "space-between"
      }}>
        {endpoints.map(endpoint => (
          <ChartCard
            key={endpoint.key}
            label={endpoint.label}
            data={charts[endpoint.key]}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
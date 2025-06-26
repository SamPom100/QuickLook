import React, { useState } from "react";
import SearchBar from "./components/search_bar";
import ChartCard from "./components/chart_card";

const endpoints = [
  { key: "revenue", label: "Revenue" },
  { key: "gross-profit", label: "Gross Profit" },
  { key: "operating-income", label: "Operating Income" },
  { key: "ebitda", label: "EBITDA" },
  { key: "net-income", label: "Net Income" },
  { key: "eps", label: "EPS" },
  { key: "shares-outstanding", label: "Shares Outstanding" },
];

function App() {
  const [ticker, setTicker] = useState("");
  const [charts, setCharts] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    const newCharts = {};
    const tickerLower = ticker.trim().toLowerCase(); // API expects lowercase
    for (const endpoint of endpoints) {
      console.log(`Fetching ${endpoint.key} for ${tickerLower}`);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/${endpoint.key}/${tickerLower}`
        );
        if (!res.ok) {
          const errorText = await res.text();
          console.error(
            `Error fetching ${endpoint.key} for ${tickerLower}: ${res.status} ${res.statusText} - ${errorText}`
          );
          throw new Error("No data");
        }
        const data = await res.json();
        console.log(`Received data for ${endpoint.key}:`, data);
        // Transform array of objects [{date, value}] to { years: [...], values: [...] }
        if (Array.isArray(data) && data.length && data[0].date) {
          // Find the value key (not "date")
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
          `Failed to fetch ${endpoint.key} for ${tickerLower}:`,
          err
        );
        newCharts[endpoint.key] = null;
      }
    }
    setCharts(newCharts);
    setLoading(false);
  };

  return (
    <div style={{
      maxWidth: 900, margin: "40px auto", padding: 24, background: "#fff",
      borderRadius: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.07)"
    }}>
      <SearchBar
        ticker={ticker}
        setTicker={setTicker}
        loading={loading}
        onSearch={handleSearch}
      />
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between"
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
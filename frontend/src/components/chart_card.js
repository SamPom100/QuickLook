import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function ChartCard({ label, data }) {
  // Prepare data for recharts, reverse so most recent is rightmost
  const chartData = data && data.years
    ? data.years.map((year, i) => ({
        year,
        value: Number(data.values[i])
      })).reverse()
    : [];

  return (
    <div style={{
      flex: "1 1 350px", minWidth: 300, background: "#f1f5f9",
      borderRadius: 8, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", alignItems: "center"
    }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>{label}</div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis 
              dataKey="year" 
              tickFormatter={str => str.slice(0, 4)} // Show only year
              interval="preserveEnd" // Show first and last
              minTickGap={20}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      ) : data === null ? (
        <div style={{ color: "#dc2626", marginTop: 10 }}>No data</div>
      ) : null}
    </div>
  );
}

export default ChartCard;
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

function ChartCard({ label, data }) {
  // Prepare data for recharts, reverse so most recent is rightmost
  const chartData = data && data.years
    ? data.years.map((year, i) => ({
        year,
        value: Number(data.values[i])
      })).reverse()
    : [];

  // Find min and max values for Y axis domain
  const values = chartData.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Helper to round to nearest nice increment for any range (handles small/decimal values)
  function getNiceIncrement(range) {
    if (range <= 2) return 0.5;
    if (range <= 5) return 1;
    if (range <= 10) return 2;
    if (range <= 20) return 5;
    if (range <= 50) return 10;
    if (range <= 200) return 50;
    if (range <= 500) return 100;
    if (range <= 2000) return 500;
    if (range <= 5000) return 1000;
    if (range <= 10000) return 2000;
    if (range <= 20000) return 5000;
    return 10000;
  }

  // Calculate nice min/max for Y axis
  const range = maxValue - minValue;
  const increment = getNiceIncrement(range);

  // Pad min/max to nearest increment, handle decimals
  const yMin = minValue < 0
    ? Math.floor(minValue / increment) * increment
    : 0;
  const yMax = Math.ceil(maxValue / increment) * increment;

  // Format numbers with commas, handle decimals
  const numberFormatter = (num) =>
    typeof num === "number"
      ? Math.abs(num) < 1
        ? num.toFixed(2)
        : num % 1 !== 0
        ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : num.toLocaleString()
      : num;

  return (
    <div style={{
      flex: "1 1 420px", // Larger minWidth for less clipping
      minWidth: 420,
      background: "#f1f5f9",
      borderRadius: 8,
      padding: 28, // More padding
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>{label}</div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
            <XAxis
              dataKey="year"
              tickFormatter={str => str.slice(0, 4)}
              interval="preserveEnd"
              minTickGap={20}
            />
            <YAxis
              tickFormatter={numberFormatter}
              width={80} // Give more space for large numbers
              domain={[yMin, yMax]}
              tickCount={Math.max(2, Math.round((yMax - yMin) / increment) + 1)}
            />
            <Tooltip formatter={numberFormatter} />
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
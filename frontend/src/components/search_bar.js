import React from "react";

function SearchBar({ ticker, setTicker, loading, onSearch }) {
  return (
    <form
      style={{ display: "flex", gap: 12, marginBottom: 32 }}
      onSubmit={onSearch}
    >
      <input
        style={{
          flex: 1, padding: 12, fontSize: "1.1rem",
          border: "1px solid #e2e8f0", borderRadius: 6
        }}
        placeholder="Enter ticker (e.g. AAPL)"
        value={ticker}
        onChange={e => setTicker(e.target.value)}
        required
      />
      <button
        style={{
          padding: "12px 24px", background: "#2563eb", color: "#fff",
          border: "none", borderRadius: 6, fontSize: "1.1rem", cursor: "pointer"
        }}
        type="submit"
        disabled={loading}
      >
        {loading ? "Loading..." : "Search"}
      </button>
    </form>
  );
}

export default SearchBar;
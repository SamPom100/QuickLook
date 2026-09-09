import React, { useState, useEffect } from 'react';
import { MONOKAI } from './theme';

const RECENT_STORAGE_KEY = 'quicklook_recent_tickers';
const DEFAULT_RECENTS = ['MSFT', 'NVDA', 'AAPL', 'AMZN', 'GOOGL'];

function getInitialRecents() {
  try {
    const saved = localStorage.getItem(RECENT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_RECENTS;
}

export default function MonokaiHeader({
  ticker,
  data,
  loading,
  onSearch,
}) {
  const [searchInput, setSearchInput] = useState(ticker || 'MSFT');
  const [recents, setRecents] = useState(getInitialRecents);

  // Sync search input when active ticker changes
  useEffect(() => {
    if (ticker) {
      setSearchInput(ticker);
      const upper = ticker.toUpperCase();
      setRecents((prev) => {
        const filtered = prev.filter((t) => t !== upper);
        const updated = [upper, ...filtered].slice(0, 6);
        try {
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          // ignore
        }
        return updated;
      });
    }
  }, [ticker]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = searchInput.trim().toUpperCase();
    if (val) onSearch(val);
  };

  const kpis = data?.kpis || {};
  const currentPrice = kpis.latestPrice || 0;
  const stockPrices = data?.stockPrices || [];
  const prevPrice = stockPrices.length >= 2 ? stockPrices[stockPrices.length - 2].y : currentPrice;
  const dayDelta = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
  const isPositive = dayDelta >= 0;

  // Format Large Numbers
  const formatDollar = (val) => {
    if (!val || val === 0) return '—';
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toFixed(2)}`;
  };

  return (
    <header style={{
      background: MONOKAI.bgDark,
      borderBottom: `1px solid ${MONOKAI.border}`,
      padding: '14px 24px',
      marginBottom: 20,
      borderRadius: '0 0 10px 10px',
    }}>
      {/* Top Command Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 16,
      }}>
        {/* Logo & Prompt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: MONOKAI.monoFont,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: MONOKAI.cyan,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ color: MONOKAI.pink }}>&gt;</span> quicklook<span style={{ color: MONOKAI.green }}>_</span>
          </span>
          <span style={{
            fontSize: 11,
            fontFamily: MONOKAI.monoFont,
            color: MONOKAI.muted,
            border: `1px solid ${MONOKAI.borderSubtle}`,
            padding: '2px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Terminal v4
          </span>
        </div>

        {/* Search Bar & Quick Ticker Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                placeholder="TICKER"
                spellCheck={false}
                style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: MONOKAI.text,
                  background: MONOKAI.bg,
                  border: `1px solid ${MONOKAI.border}`,
                  borderRadius: 6,
                  padding: '7px 12px',
                  width: 140,
                  letterSpacing: '0.06em',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = MONOKAI.cyan; }}
                onBlur={(e) => { e.target.style.borderColor = MONOKAI.border; }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                fontFamily: MONOKAI.monoFont,
                fontSize: 12,
                fontWeight: 700,
                color: MONOKAI.bgDark,
                background: loading ? MONOKAI.muted : MONOKAI.green,
                border: 'none',
                borderRadius: 6,
                padding: '8px 14px',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'opacity 0.2s, transform 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1.0'; }}
            >
              {loading ? 'LOAD...' : 'RUN'}
            </button>
          </form>

          {/* Recent searches history */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {recents.map((t) => {
              const isActive = ticker === t;
              return (
                <button
                  key={t}
                  onClick={() => { setSearchInput(t); onSearch(t); }}
                  title={`Switch to ${t}`}
                  style={{
                    fontFamily: MONOKAI.monoFont,
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? MONOKAI.cyan : MONOKAI.muted,
                    background: isActive ? MONOKAI.bgElevated : 'transparent',
                    border: `1px solid ${isActive ? MONOKAI.cyan : MONOKAI.borderSubtle}`,
                    borderRadius: 4,
                    padding: '3px 7px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = MONOKAI.muted;
                      e.currentTarget.style.color = MONOKAI.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                      e.currentTarget.style.color = MONOKAI.muted;
                    }
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>


      </div>

      {/* Telemetry Strip for Selected Ticker */}
      {data && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingTop: 12,
          borderTop: `1px solid ${MONOKAI.borderSubtle}`,
        }}>
          {/* Ticker & Price Group */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 24,
              fontWeight: 800,
              color: MONOKAI.text,
              letterSpacing: '0.04em',
            }}>
              {ticker}
            </span>
            <span style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 22,
              fontWeight: 700,
              color: MONOKAI.yellow,
            }}>
              ${currentPrice > 0 ? currentPrice.toFixed(2) : '—'}
            </span>
            {dayDelta !== 0 && (
              <span style={{
                fontFamily: MONOKAI.monoFont,
                fontSize: 12,
                fontWeight: 700,
                color: isPositive ? MONOKAI.green : MONOKAI.pink,
                background: isPositive ? 'rgba(166, 226, 46, 0.12)' : 'rgba(249, 38, 114, 0.12)',
                border: `1px solid ${isPositive ? 'rgba(166, 226, 46, 0.3)' : 'rgba(249, 38, 114, 0.3)'}`,
                borderRadius: 4,
                padding: '2px 6px',
              }}>
                {isPositive ? '+' : ''}{dayDelta.toFixed(2)}%
              </span>
            )}
          </div>

          {/* Key Fundamentals Metrics Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={telemetryPillStyle}>
              <span style={{ color: MONOKAI.muted }}>TTM EPS</span>
              <span style={{ color: MONOKAI.text, fontWeight: 700 }}>
                {kpis.epsTTM != null ? `$${kpis.epsTTM.toFixed(2)}` : '—'}
              </span>
            </div>
            <div style={telemetryPillStyle}>
              <span style={{ color: MONOKAI.muted }}>P/E TTM</span>
              <span style={{ color: MONOKAI.purple, fontWeight: 700 }}>
                {kpis.ttmPE != null ? `${kpis.ttmPE.toFixed(1)}x` : '—'}
              </span>
            </div>
            <div style={telemetryPillStyle}>
              <span style={{ color: MONOKAI.muted }}>5Y MED P/E</span>
              <span style={{ color: MONOKAI.orange, fontWeight: 700 }}>
                {kpis.medianPE5YClean || kpis.medianPE5Y != null ? `${(kpis.medianPE5YClean || kpis.medianPE5Y).toFixed(1)}x` : '—'}
              </span>
            </div>
            <div style={telemetryPillStyle}>
              <span style={{ color: MONOKAI.muted }}>5Y CAGR</span>
              <span style={{ color: (kpis.epsGrowth5Y || 0) >= 0 ? MONOKAI.green : MONOKAI.pink, fontWeight: 700 }}>
                {kpis.epsGrowth5Y != null ? `${kpis.epsGrowth5Y.toFixed(1)}%` : '—'}
              </span>
            </div>
            {kpis.marketCap && (
              <div style={telemetryPillStyle}>
                <span style={{ color: MONOKAI.muted }}>MCAP</span>
                <span style={{ color: MONOKAI.cyan, fontWeight: 700 }}>
                  {formatDollar(kpis.marketCap)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const telemetryPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: MONOKAI.bgSurface,
  border: `1px solid ${MONOKAI.borderSubtle}`,
  borderRadius: 4,
  padding: '3px 8px',
  fontFamily: MONOKAI.monoFont,
  fontSize: 11,
};

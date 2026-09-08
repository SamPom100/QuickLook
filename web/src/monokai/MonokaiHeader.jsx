import React, { useState } from 'react';
import { MONOKAI } from './theme';

const POPULAR_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'];

export default function MonokaiHeader({
  ticker,
  data,
  loading,
  onSearch,
  uiMode,
  onToggleUiMode,
}) {
  const [searchInput, setSearchInput] = useState(ticker || 'MSFT');

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

          {/* Quick presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {POPULAR_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => { setSearchInput(t); onSearch(t); }}
                style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 11,
                  fontWeight: 600,
                  color: ticker === t ? MONOKAI.cyan : MONOKAI.muted,
                  background: ticker === t ? MONOKAI.bgElevated : 'transparent',
                  border: `1px solid ${ticker === t ? MONOKAI.cyan : MONOKAI.borderSubtle}`,
                  borderRadius: 4,
                  padding: '3px 7px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* View Switcher Pill (Monokai vs Classic) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: MONOKAI.bg,
          border: `1px solid ${MONOKAI.border}`,
          borderRadius: 6,
          padding: 2,
        }}>
          <button
            onClick={() => onToggleUiMode('monokai')}
            style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              background: uiMode === 'monokai' ? MONOKAI.cyan : 'transparent',
              color: uiMode === 'monokai' ? MONOKAI.bgDark : MONOKAI.muted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            ⚡ Monokai
          </button>
          <button
            onClick={() => onToggleUiMode('classic')}
            style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              background: uiMode === 'classic' ? '#f0f0f0' : 'transparent',
              color: uiMode === 'classic' ? '#222' : MONOKAI.muted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Classic
          </button>
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

          {/* Competitor Benchmarks Pills */}
          {data.peers && data.peers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 10,
                fontFamily: MONOKAI.monoFont,
                color: MONOKAI.muted,
                textTransform: 'uppercase',
              }}>
                Peers:
              </span>
              {data.peers.slice(0, 5).map((p) => {
                const sym = typeof p === 'string' ? p : p.ticker;
                const peVal = typeof p === 'object' && p.peRatio ? parseFloat(p.peRatio) : null;
                const pe = peVal != null && !isNaN(peVal) ? ` ${peVal.toFixed(1)}x` : '';
                return (
                  <button
                    key={sym}
                    onClick={() => { setSearchInput(sym); onSearch(sym); }}
                    title={typeof p === 'object' && p.name ? p.name : sym}
                    style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 11,
                      fontWeight: 600,
                      color: MONOKAI.textDim,
                      background: MONOKAI.bgSurface,
                      border: `1px solid ${MONOKAI.borderSubtle}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = MONOKAI.cyan;
                      e.currentTarget.style.color = MONOKAI.cyan;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                      e.currentTarget.style.color = MONOKAI.textDim;
                    }}
                  >
                    {sym}<span style={{ color: MONOKAI.muted, fontSize: 10 }}>{pe}</span>
                  </button>
                );
              })}
            </div>
          )}
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

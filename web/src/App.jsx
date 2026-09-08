import React, { useEffect, useState, useCallback } from 'react';
import FinancialChart from './components/FinancialChart';
import MonokaiHeader from './monokai/MonokaiHeader';
import MonokaiDashboard from './monokai/MonokaiDashboard';
import { MONOKAI } from './monokai/theme';

export default function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [input, setInput] = useState('MSFT');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isThrottledError, setIsThrottledError] = useState(false);
  const [dismissNotice, setDismissNotice] = useState(false);

  // UI Mode: 'monokai' (Default, Streamlined Minimalist) or 'classic'
  const [uiMode, setUiMode] = useState(() => {
    return localStorage.getItem('quicklook_ui_mode') || 'monokai';
  });

  const handleToggleUiMode = (mode) => {
    setUiMode(mode);
    localStorage.setItem('quicklook_ui_mode', mode);
  };

  // Sync Body Background Color to Theme
  useEffect(() => {
    if (uiMode === 'monokai') {
      document.body.style.backgroundColor = MONOKAI.bg;
      document.body.style.color = MONOKAI.text;
    } else {
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#0f172a';
    }
  }, [uiMode]);

  const fetchData = useCallback(async (t) => {
    setLoading(true);
    setError(null);
    setIsThrottledError(false);
    setDismissNotice(false);
    try {
      const res = await fetch(`/api/data/${t.toUpperCase()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsThrottledError(Boolean(body.isThrottled || res.status === 429));
        throw new Error(body.error || `No financial data found for ${t}`);
      }
      setData(body);
      setTicker(t.toUpperCase());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData('MSFT');
  }, [fetchData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = input.trim();
    if (val) fetchData(val);
  };

  const handleSelectTicker = useCallback((t) => {
    const sym = t.toUpperCase();
    setInput(sym);
    fetchData(sym);
  }, [fetchData]);

  // ===================== MONOKAI VIEW (STREAMLINED & MINIMAL) =====================
  if (uiMode === 'monokai') {
    return (
      <div style={{
        maxWidth: 1600,
        margin: '0 auto',
        padding: '0 16px 32px 16px',
        minHeight: '100vh',
        fontFamily: MONOKAI.monoFont,
      }}>
        <MonokaiHeader
          ticker={ticker}
          data={data}
          loading={loading}
          onSearch={handleSelectTicker}
          uiMode={uiMode}
          onToggleUiMode={handleToggleUiMode}
        />

        {/* Throttling / Rate-Limit Notices (Monokai Styled) */}
        {data?.notice && !dismissNotice && !error && (
          <div style={{
            background: MONOKAI.bgDark,
            border: `1px solid ${MONOKAI.orange}`,
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: MONOKAI.orange,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⏳</span>
              <span><strong>API THROTTLED:</strong> {data.notice}</span>
            </div>
            <button
              onClick={() => setDismissNotice(true)}
              style={{
                background: 'none',
                border: 'none',
                color: MONOKAI.orange,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              [x]
            </button>
          </div>
        )}

        {error && (
          <div style={{
            background: MONOKAI.bgDark,
            border: `1px solid ${isThrottledError ? MONOKAI.orange : MONOKAI.pink}`,
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: isThrottledError ? MONOKAI.orange : MONOKAI.pink,
          }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {isThrottledError ? '⏳ ALPHA VANTAGE RATE LIMIT' : '⚠️ DATA LOAD ERROR'}
              </div>
              <div style={{ color: MONOKAI.textDim }}>
                {isThrottledError ? 'Free tier limit reached. Wait ~15s and retry.' : error}
              </div>
            </div>
            <button
              onClick={() => fetchData(ticker)}
              style={{
                background: isThrottledError ? MONOKAI.orange : MONOKAI.pink,
                color: MONOKAI.bgDark,
                border: 'none',
                borderRadius: 4,
                padding: '6px 14px',
                fontFamily: MONOKAI.monoFont,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              RETRY
            </button>
          </div>
        )}

        {/* Main Monokai Dashboard */}
        {data && (
          <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            <MonokaiDashboard data={data} />
          </div>
        )}
      </div>
    );
  }

  // ===================== CLASSIC VIEW (ORIGINAL UNTOUCHED) =====================
  return (
    <div style={{ padding: '16px 20px', width: '100%', margin: '0 auto' }}>
      {/* Classic Top Row with UI Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g. AMZN)"
            spellCheck={false}
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Mono", Menlo, monospace',
              fontSize: 16,
              fontWeight: 600,
              padding: '10px 16px',
              border: '2px solid #ccc',
              borderRadius: 8,
              outline: 'none',
              width: 200,
              letterSpacing: '0.05em',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#1f77b4'; }}
            onBlur={(e) => { e.target.style.borderColor = '#ccc'; }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 24px',
              background: loading ? '#999' : '#1f77b4',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.background = '#175e96'; }}
            onMouseLeave={(e) => { if (!loading) e.target.style.background = '#1f77b4'; }}
          >
            {loading ? 'Fetching Data…' : 'Search'}
          </button>
          {loading && (
            <span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
              Fetching financial statements & stock history…
            </span>
          )}
        </form>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          padding: 2,
        }}>
          <button
            onClick={() => handleToggleUiMode('monokai')}
            style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            ⚡ Switch to Monokai
          </button>
          <button
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 4,
              border: 'none',
              background: '#0284c7',
              color: '#fff',
              cursor: 'default',
            }}
          >
            Classic
          </button>
        </div>
      </div>

      {/* Alpha Vantage Active Throttling Banner */}
      {data?.notice && !dismissNotice && !error && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#92400e',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⏳</span>
            <span><strong>API Throttled:</strong> {data.notice}</span>
          </div>
          <button
            onClick={() => setDismissNotice(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#92400e',
              fontSize: 16,
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0 4px',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Throttled Error Banner */}
      {error && isThrottledError && (
        <div style={{
          color: '#9a3412',
          fontSize: 14,
          marginBottom: 16,
          padding: '12px 18px',
          background: '#fff7ed',
          borderRadius: 8,
          border: '1px solid #fdba74',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>⏳ Alpha Vantage Rate Limit Reached</div>
            <div style={{ fontSize: 13, color: '#c2410c' }}>
              Free tier allows 5 calls/min. Please wait ~15 seconds and retry.
            </div>
          </div>
          <button
            onClick={() => fetchData(input.trim() || ticker)}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: '#ea580c',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.target.style.background = '#c2410c'; }}
            onMouseLeave={(e) => { e.target.style.background = '#ea580c'; }}
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Generic Error Banner */}
      {error && !isThrottledError && (
        <div style={{
          color: '#c00',
          fontSize: 14,
          marginBottom: 16,
          padding: '10px 16px',
          background: '#fff0f0',
          borderRadius: 6,
          border: '1px solid #fcc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => fetchData(input.trim() || 'MSFT')}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: '#c00',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          <FinancialChart data={data} onSelectTicker={handleSelectTicker} />
        </div>
      )}
    </div>
  );
}

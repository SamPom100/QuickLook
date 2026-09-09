import React, { useEffect, useState, useCallback } from 'react';
import MonokaiHeader from './monokai/MonokaiHeader';
import MonokaiDashboard from './monokai/MonokaiDashboard';
import { MONOKAI } from './monokai/theme';

export default function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isThrottledError, setIsThrottledError] = useState(false);
  const [dismissNotice, setDismissNotice] = useState(false);

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

  const handleSelectTicker = useCallback((t) => {
    const sym = t.toUpperCase();
    fetchData(sym);
  }, [fetchData]);
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
            <MonokaiDashboard data={data} onSelectTicker={handleSelectTicker} />
          </div>
        )}
      </div>
    );
}

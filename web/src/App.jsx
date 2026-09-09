import React, { useEffect, useState, useCallback } from 'react';
import MonokaiHeader from './monokai/MonokaiHeader';
import MonokaiDashboard from './monokai/MonokaiDashboard';
import MonokaiErrorBoundary from './monokai/MonokaiErrorBoundary';
import { MONOKAI } from './monokai/theme';

export default function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isThrottledError, setIsThrottledError] = useState(false);
  const [isInvalidTicker, setIsInvalidTicker] = useState(false);
  const [dismissNotice, setDismissNotice] = useState(false);
  const [lastAttemptedTicker, setLastAttemptedTicker] = useState('');

  const fetchData = useCallback(async (t) => {
    const sym = (t || '').trim().toUpperCase();
    if (!sym) return;

    setLastAttemptedTicker(sym);

    // Instant client-side format validation (<1ms)
    if (sym.length > 10 || !/^[A-Z0-9.\-]+$/.test(sym)) {
      setError(`Invalid ticker format "${sym}". Ticker must contain only letters, numbers, dot, or hyphen.`);
      setIsInvalidTicker(true);
      setIsThrottledError(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsThrottledError(false);
    setIsInvalidTicker(false);
    setDismissNotice(false);

    try {
      const res = await fetch(`/api/data/${encodeURIComponent(sym)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const isThrottled = Boolean(body.isThrottled || res.status === 429);
        const isInvalid = Boolean(body.isInvalidTicker || res.status === 404 || res.status === 400);
        setIsThrottledError(isThrottled);
        setIsInvalidTicker(isInvalid);
        throw new Error(body.error || `Symbol '${sym}' could not be loaded.`);
      }
      setData(body);
      setTicker(sym);
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
    fetchData(t);
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

      {/* Throttling / Rate-Limit Notice */}
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

      {/* Clean Monokai Error Banner */}
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
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>{isInvalidTicker ? '❌' : isThrottledError ? '⏳' : '⚠️'}</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2, letterSpacing: '0.04em' }}>
                {isInvalidTicker
                  ? 'SYMBOL NOT FOUND'
                  : isThrottledError
                  ? 'ALPHA VANTAGE RATE LIMIT'
                  : 'DATA LOAD ERROR'}
              </div>
              <div style={{ color: MONOKAI.textDim }}>
                {isThrottledError
                  ? 'Free tier limit reached. Please wait ~15s and click Retry.'
                  : error}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setError(null);
                setIsInvalidTicker(false);
                setIsThrottledError(false);
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${MONOKAI.borderSubtle}`,
                color: MONOKAI.muted,
                borderRadius: 4,
                padding: '6px 12px',
                fontFamily: MONOKAI.monoFont,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              DISMISS
            </button>
            {isInvalidTicker && ticker && (
              <button
                onClick={() => fetchData(ticker)}
                style={{
                  background: MONOKAI.cyan,
                  color: MONOKAI.bgDark,
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 14px',
                  fontFamily: MONOKAI.monoFont,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                BACK TO {ticker}
              </button>
            )}
            {!isInvalidTicker && (
              <button
                onClick={() => fetchData(lastAttemptedTicker || ticker)}
                style={{
                  background: isThrottledError ? MONOKAI.orange : MONOKAI.pink,
                  color: MONOKAI.bgDark,
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 14px',
                  fontFamily: MONOKAI.monoFont,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                RETRY
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean Monokai Empty State when no data is loaded */}
      {!data && !loading && (
        <div style={{
          background: MONOKAI.bgDark,
          border: `1px dashed ${error ? MONOKAI.pink : MONOKAI.borderSubtle}`,
          borderRadius: 8,
          padding: '64px 24px',
          textAlign: 'center',
          marginTop: 20,
          fontFamily: MONOKAI.monoFont,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            {error ? '❌' : '🔍'}
          </div>
          <div style={{
            color: error ? MONOKAI.pink : MONOKAI.cyan,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}>
            // {error ? 'NO FINANCIAL DATA AVAILABLE' : 'READY TO SEARCH'}
          </div>
          <div style={{
            color: MONOKAI.muted,
            fontSize: 12,
            maxWidth: 480,
            margin: '0 auto 20px auto',
            lineHeight: 1.6,
          }}>
            {error
              ? `Symbol "${lastAttemptedTicker}" does not exist, has been delisted, or has no available financial filings.`
              : 'Enter a valid stock ticker symbol above and click RUN to load valuation metrics and financial statements.'}
          </div>
          <button
            onClick={() => fetchData('MSFT')}
            style={{
              background: MONOKAI.green,
              color: MONOKAI.bgDark,
              border: 'none',
              borderRadius: 4,
              padding: '8px 20px',
              fontFamily: MONOKAI.monoFont,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            LOAD MSFT BENCHMARK
          </button>
        </div>
      )}

      {/* Main Monokai Dashboard with Error Boundary */}
      {data && (
        <MonokaiErrorBoundary
          fallbackTitle="DASHBOARD RENDER ERROR"
          card={false}
          onReset={() => fetchData(ticker)}
        >
          <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            <MonokaiDashboard data={data} onSelectTicker={handleSelectTicker} />
          </div>
        </MonokaiErrorBoundary>
      )}
    </div>
  );
}


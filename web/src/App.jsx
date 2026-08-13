import { useEffect, useState, useCallback } from 'react';
import FinancialChart from './components/FinancialChart';

export default function App() {
  const [ticker, setTicker] = useState('MSFT');
  const [input, setInput] = useState('MSFT');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (t) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/${t.toUpperCase()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `No financial data found for ${t}`);
      }
      const json = await res.json();
      setData(json);
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

  return (
    <div style={{ padding: '16px 20px', width: '100%', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
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
            Fetching financial statements & stock history from Alpha Vantage…
          </span>
        )}
      </form>

      {error && (
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
            onClick={() => fetchData(input.trim() || 'AMZN')}
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

import React from 'react';
import { MONOKAI } from './theme';

const TABS = [
  { id: 'cash',        number: '01', label: 'Cash & Earnings' },
  { id: 'valuation',   number: '02', label: 'Valuation History' },
  { id: 'growth',      number: '03', label: 'Relative % Return' },
  { id: 'dcf_drivers', number: '04', label: 'DCF Drivers' },
  { id: 'dcf',         number: '05', label: 'DCF Valuation Model' },
];

const TIMEFRAMES = [
  { id: '1Y',  label: '1Y',  quarters: 4 },
  { id: '3Y',  label: '3Y',  quarters: 12 },
  { id: '5Y',  label: '5Y',  quarters: 20 },
  { id: '10Y', label: '10Y', quarters: 40 },
  { id: 'MAX', label: 'MAX', quarters: null },
];

export default function MonokaiNavigation({
  activeTab,
  onSelectTab,
  timeframe,
  onSelectTimeframe,
  legendItems = [],
  hiddenSeries,
  onToggleSeries,
}) {
  const showTimeframe = activeTab !== 'dcf';

  return (
    <nav style={{
      background: MONOKAI.bgDark,
      border: `1px solid ${MONOKAI.border}`,
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 16,
    }}>
      {/* Top Row: Tabs & Timeframe Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: MONOKAI.bg,
          border: `1px solid ${MONOKAI.borderSubtle}`,
          borderRadius: 6,
          padding: 2,
          gap: 2,
          flexWrap: 'wrap',
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? MONOKAI.text : MONOKAI.muted,
                  background: isActive ? MONOKAI.bgElevated : 'transparent',
                  border: `1px solid ${isActive ? MONOKAI.border : 'transparent'}`,
                  borderRadius: 4,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <span style={{
                  color: isActive ? MONOKAI.cyan : MONOKAI.border,
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {tab.number}
                </span>
                <span>{tab.label}</span>
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 8,
                    right: 8,
                    height: 2,
                    background: MONOKAI.cyan,
                    borderRadius: 1,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Timeframe Selector (1Y / 3Y / 5Y / 10Y / MAX) */}
        {showTimeframe && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: MONOKAI.bg,
            border: `1px solid ${MONOKAI.borderSubtle}`,
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}>
            <span style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 10,
              color: MONOKAI.muted,
              padding: '0 6px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              Range:
            </span>
            {TIMEFRAMES.map((tf) => {
              const isSelected = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  onClick={() => onSelectTimeframe(tf.id)}
                  style={{
                    fontFamily: MONOKAI.monoFont,
                    fontSize: 11,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? MONOKAI.bgDark : MONOKAI.textDim,
                    background: isSelected ? MONOKAI.yellow : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Row: Series Toggle Pills (Visible for standard chart tabs) */}
      {legendItems.length > 0 && activeTab !== 'dcf' && activeTab !== 'dcf_drivers' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${MONOKAI.borderSubtle}`,
        }}>
          <span style={{
            fontFamily: MONOKAI.monoFont,
            fontSize: 10,
            fontWeight: 700,
            color: MONOKAI.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginRight: 4,
          }}>
            Series:
          </span>
          {legendItems.map((item) => {
            const isHidden = hiddenSeries.has(item.key);
            return (
              <button
                key={item.key}
                onClick={() => onToggleSeries(item.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 11,
                  fontWeight: isHidden ? 500 : 600,
                  color: isHidden ? MONOKAI.muted : MONOKAI.text,
                  background: isHidden ? 'transparent' : MONOKAI.bgSurface,
                  border: `1px solid ${isHidden ? MONOKAI.borderSubtle : MONOKAI.border}`,
                  borderRadius: 4,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  opacity: isHidden ? 0.45 : 1.0,
                  textDecoration: isHidden ? 'line-through' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Visual Swatch */}
                {item.type === 'bar' && (
                  <span style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    background: item.color,
                    display: 'inline-block',
                  }} />
                )}
                {item.type === 'line' && (
                  <span style={{
                    width: 12,
                    height: 2,
                    background: item.color,
                    display: 'inline-block',
                  }} />
                )}
                {item.type === 'dotted' && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: item.color }} />
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: item.color }} />
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: item.color }} />
                  </span>
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

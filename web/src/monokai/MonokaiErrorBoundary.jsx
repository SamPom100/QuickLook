import React from 'react';
import { MONOKAI } from './theme';

export default class MonokaiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MonokaiErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const isCard = this.props.card !== false;
      const title = this.props.fallbackTitle || 'CHART ERROR';
      const errMsg = this.state.error?.message || 'Unexpected calculation or rendering error';

      if (isCard) {
        return (
          <div style={{
            background: MONOKAI.bgDark,
            border: `1px dashed ${MONOKAI.pink}`,
            borderRadius: 8,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: (this.props.height || 95) + 85,
            fontFamily: MONOKAI.monoFont,
          }}>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: MONOKAI.pink,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  // {title}
                </span>
                <span style={{
                  fontSize: 10,
                  color: MONOKAI.pink,
                  background: 'rgba(249, 38, 114, 0.15)',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}>
                  ERROR
                </span>
              </div>
              <div style={{
                fontSize: 11,
                color: MONOKAI.muted,
                marginTop: 8,
                lineHeight: 1.4,
              }}>
                {errMsg}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(249, 38, 114, 0.08)',
              borderRadius: 6,
              border: `1px dashed rgba(249, 38, 114, 0.3)`,
              padding: '12px 8px',
              marginTop: 10,
            }}>
              <button
                onClick={this.handleReset}
                style={{
                  background: 'transparent',
                  border: `1px solid ${MONOKAI.pink}`,
                  color: MONOKAI.pink,
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontSize: 10,
                  fontFamily: MONOKAI.monoFont,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                RELOAD CHART
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{
          background: MONOKAI.bgDark,
          border: `1px solid ${MONOKAI.pink}`,
          borderRadius: 8,
          padding: '24px',
          margin: '16px 0',
          fontFamily: MONOKAI.monoFont,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>⚠️</div>
          <div style={{ color: MONOKAI.pink, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            // {title}
          </div>
          <div style={{ color: MONOKAI.muted, fontSize: 11, maxWidth: 500, margin: '0 auto 14px auto' }}>
            {errMsg}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              background: MONOKAI.pink,
              color: MONOKAI.bgDark,
              border: 'none',
              borderRadius: 4,
              padding: '6px 16px',
              fontFamily: MONOKAI.monoFont,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

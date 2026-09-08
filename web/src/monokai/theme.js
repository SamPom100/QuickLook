// Monokai Pro / Classic Palette Tokens
export const MONOKAI = {
  // Backgrounds
  bg: '#272822',          // Main Monokai background
  bgDark: '#1e1f1c',      // Darker canvas & cards
  bgSurface: '#2e2f2a',   // Card background
  bgElevated: '#383a34',  // Hover / Elevated states
  bgActive: '#49483e',    // Active / Selected state

  // Borders & Grid
  border: '#49483e',
  borderSubtle: '#3e3d32',
  gridLine: 'rgba(73, 72, 62, 0.45)',

  // Typography
  text: '#f8f8f2',        // Primary text
  muted: '#75715e',       // Comments / Labels
  textDim: '#a5a498',     // Secondary text

  // Vibrant Functional Accents
  cyan: '#66d9ef',        // Keywords, Revenue, Stock Price, Search Focus
  green: '#a6e22e',       // Functions, Net Income, Buy Target, Bull
  yellow: '#e6db74',      // Strings, Free Cash Flow, Milestones
  orange: '#fd971f',      // Parameters, YoY Growth, CAGR, Outliers
  pink: '#f92672',        // Operators, Negative, Discount, Bear, Stop
  purple: '#ae81ff',      // Constants, Valuation, P/E Multiple

  // Fonts
  monoFont: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  sansFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

// Common reusable styles
export const monokaiCardStyle = {
  background: MONOKAI.bgDark,
  border: `1px solid ${MONOKAI.borderSubtle}`,
  borderRadius: 8,
  padding: '16px',
};

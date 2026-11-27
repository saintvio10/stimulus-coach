/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        rec: {
          gray: 'rgb(var(--rec-gray) / <alpha-value>)',
          green: 'rgb(var(--rec-green) / <alpha-value>)',
          yellow: 'rgb(var(--rec-yellow) / <alpha-value>)',
          orange: 'rgb(var(--rec-orange) / <alpha-value>)',
          red: 'rgb(var(--rec-red) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem' },
      keyframes: {
        'fade-up': { from: { opacity: '0.001', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        shrink: { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'slide-in-r': { from: { opacity: '0', transform: 'translateX(40px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-l': { from: { opacity: '0', transform: 'translateX(-40px)' }, to: { opacity: '1', transform: 'none' } },
        'muscle-glow': { '0%, 100%': { opacity: '0.22' }, '50%': { opacity: '0.62' } },
        'muscle-tint': { '0%, 100%': { opacity: '0.66' }, '50%': { opacity: '0.82' } },
      },
      animation: { shrink: 'shrink 3s linear forwards', 'fade-up': 'fade-up .35s cubic-bezier(.2,.8,.2,1) both', 'sheet-up': 'sheet-up .32s cubic-bezier(.2,.8,.2,1) both', 'slide-in-r': 'slide-in-r .3s cubic-bezier(.2,.8,.2,1) both', 'slide-in-l': 'slide-in-l .3s cubic-bezier(.2,.8,.2,1) both', 'muscle-glow': 'muscle-glow 2.8s ease-in-out infinite', 'muscle-tint': 'muscle-tint 2.8s ease-in-out infinite' },
    },
  },
  plugins: [],
};

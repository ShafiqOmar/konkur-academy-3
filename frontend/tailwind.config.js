/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#16213E',
          light: '#2D4263',
          dark: '#0D1526',
        },
        gold: {
          DEFAULT: '#E8A33D',
          light: '#F2C572',
        },
        sage: {
          DEFAULT: '#4E8D7C',
          light: '#7BB5A5',
        },
        // توکن‌های معنایی که با تغییر حالت تاریک/روشن خودکار عوض می‌شوند
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        heading: 'rgb(var(--color-heading) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'blueprint-grid':
          'linear-gradient(rgb(var(--color-line) / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-line) / 0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '28px 28px',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          dark: '#070A12',
          card: '#0F1524',
          cardHover: '#161F36',
          light: '#F8FAFC',
          cardLight: '#FFFFFF',
        },
        brand: {
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          purpleGlow: 'rgba(139, 92, 246, 0.15)',
          cyanGlow: 'rgba(6, 182, 212, 0.15)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

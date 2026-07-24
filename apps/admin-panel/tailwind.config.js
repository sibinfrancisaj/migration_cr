/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — warm gold
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Secondary — rich brown / mahogany
        brown: {
          50:  '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2b48c',
          500: '#b8860b',   // dark goldenrod accent
          600: '#8B6914',
          700: '#6B4F12',
          800: '#4A3728',
          900: '#2C1A0E',
          950: '#1a0f08',
        },
        // brand alias → gold for all brand-* usages in components
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  safelist: [
    { pattern: /^(bg|text|border|ring|from|via|to|shadow)-(gold|brown)-\d+/ },
    { pattern: /^(bg|text|border|ring|from|via|to|shadow)-(gold|brown)-\d+\/([\d]+)/ },
  ],
  plugins: [],
};

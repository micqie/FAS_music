/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    './pages/admin/**/*.html',
    './js/admin/**/*.js',
    './js/index.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdfaf1',
          100: '#f9f1d5',
          400: '#d4af37',
          500: '#b8860b',
          600: '#996515',
        },
        obsidian: '#0f1115',
        darkSlate: '#1a1d23',
        ink: '#111827',
        tide: '#0f766e',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}

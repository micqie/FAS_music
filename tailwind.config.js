/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    './*.html',
    './pages/**/*.html',
    './js/**/*.js',
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
        cream: '#fafafa',
        branchBlue: '#0f4c81',
        branchMist: '#eef4fb',
        deskBlue: '#0f4c81',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}

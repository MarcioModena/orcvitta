/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3d9948',
        secondary: '#0094d9',
      },
    },
  },
  plugins: [],
};
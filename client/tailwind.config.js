/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
    screens:{
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    }
  },
  plugins: [],
};

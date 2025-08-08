/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./utils/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Tibetan Buddhist inspired colors from the website
        cream: {
          50: '#fefdfb',
          100: '#fcf8f3',
          200: '#f7f0e4',
          300: '#f2e8d5',
          400: '#ede0c6',
          500: '#e8d8b7', // Main cream color
          600: '#d4c4a6',
          700: '#b8a68f',
          800: '#9c8878',
          900: '#806a61',
        },
        burgundy: {
          50: '#fef2f2',
          100: '#fde6e6',
          200: '#fbcccc',
          300: '#f8b3b3',
          400: '#f59999',
          500: '#b91c1c', // Main burgundy red
          600: '#991b1b',
          700: '#7f1d1d',
          800: '#651e1e',
          900: '#4c1d1d',
        },
        saffron: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Main saffron yellow
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'serif': ['Georgia', 'serif'],
      },
      fontSize: {
        // Larger fonts for 40+ demographic
        'xs': ['14px', '18px'],
        'sm': ['16px', '22px'],
        'base': ['18px', '26px'],
        'lg': ['20px', '28px'],
        'xl': ['22px', '30px'],
        '2xl': ['26px', '34px'],
        '3xl': ['30px', '38px'],
      }
    },
  },
  plugins: [],
}
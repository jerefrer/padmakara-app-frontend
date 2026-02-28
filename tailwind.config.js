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
        // Refined palette aligned with padmakara.pt website
        cream: {
          50: '#ffffff',
          100: '#fefefe',
          200: '#f5f4f2',
          300: '#eeedeb',
          400: '#e8e7e5',
          500: '#e8e6e3', // Main neutral light
          600: '#d4d2cf',
          700: '#b8b6b3',
          800: '#9c9a97',
          900: '#807e7b',
        },
        burgundy: {
          50: '#f8f1f1',
          100: '#f2e0e0',
          200: '#e0bfbf',
          300: '#d09f9f',
          400: '#c08080',
          500: '#9b1b1b', // Deep muted red
          600: '#7b1616',
          700: '#5a1111',
          800: '#3a0c0c',
          900: '#2a0808',
        },
        saffron: {
          50: '#fffbeb',
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
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'serif': ['EBGaramond_400Regular', 'Georgia', 'serif'],
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
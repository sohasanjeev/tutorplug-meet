/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        meet: {
          dark: '#202124',
          darker: '#131314',
          surface: '#2d2e30',
          border: '#3c4043',
          blue: '#1a73e8',
          blueHover: '#1557b0',
          red: '#ea4335',
          green: '#0d904f',
          yellow: '#f9ab00',
        },
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-up': 'floatUp 2.5s ease-out forwards',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translateY(-120px) scale(1.4)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

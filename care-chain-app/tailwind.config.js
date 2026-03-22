/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DMSans-Regular'],
        'sans-medium': ['DMSans-Medium'],
        'sans-semibold': ['DMSans-SemiBold'],
        'sans-bold': ['DMSans-Bold'],
      },
      colors: {
        brand: {
          primary: '#130160',   // Deepest - Main Buttons
          secondary: '#1E3A8A', // Medium - Headers & Status Bars
          tertiary: '#375BD2',  // Vibrant - Active States & Accents
        }
      }
    },
  },
  plugins: [],
}
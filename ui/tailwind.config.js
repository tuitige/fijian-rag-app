/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#002D62',    // Deep Blue (from Fiji flag)
        secondary: '#CE1126',  // Red (from Fiji flag)
        accent: '#4BB4E6',     // Light Blue (ocean)
        sand: '#F5DEB3',       // Sandy beaches
        palm: '#2E8B57',       // Tropical green
        background: '#F0F8FF'  // Light blue-white
      },
      fontFamily: {
        heading: ['Lato', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

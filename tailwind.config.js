/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dash: {
          card: "#1A1B1E",
          surface: "#2C2D30",
        },
      },
    },
  },
  plugins: [],
};

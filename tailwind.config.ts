import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f8f7f4",
        surface: "#ffffff",
        border: "#e2e0eb",
        text: "#1a1830",
        text2: "#5a5873",
        text3: "#9896aa",
        accent: "#3d35a8",
        accent2: "#5a52c8",
        accentSoft: "#ededfa",
      },
    },
  },
  plugins: [],
};

export default config;

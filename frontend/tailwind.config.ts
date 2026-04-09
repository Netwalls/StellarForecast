import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#FCFAF7",
          fg: "#1A1A1A",
          accent: "#3E5C76",
          muted: "#F1EFE9",
          terra: "#D48C70",
          sage: "#8BA889",
          green: "#4A7C59",
          red: "#9B4444",
          yellow: "#D4AF37",
        },
      },
    },
  },
  plugins: [],
};

export default config;

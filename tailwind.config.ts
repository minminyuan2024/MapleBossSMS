import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#f8fafc",
          card: "#ffffff",
          muted: "#f1f5f9",
        },
        ink: {
          DEFAULT: "#0f172a",
          muted: "#64748b",
        },
        accent: {
          DEFAULT: "#2563eb",
          soft: "#dbeafe",
        },
        maple: {
          leaf: "#22c55e",
          gold: "#eab308",
        },
      },
      boxShadow: {
        soft: "0 1px 3px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06)",
        modal: "0 25px 50px -12px rgb(15 23 42 / 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;

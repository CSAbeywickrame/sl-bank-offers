import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#08271c",
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#03281d",
        },
        navy: {
          50: "#eaf0f8",
          100: "#cfdcee",
          200: "#9fbadd",
          300: "#6ea8ff",
          400: "#3d6dc4",
          500: "#234c8f",
          600: "#163664",
          700: "#10294e",
          800: "#0d2137",
          900: "#0b1f33",
          950: "#071523",
        },
        gold: {
          50: "#fbf7ea",
          100: "#f6ecc9",
          200: "#edd99b",
          300: "#e1c46e",
          400: "#d4af5f",
          500: "#c99a2e",
          600: "#a87d1f",
          700: "#856115",
          800: "#5f4510",
        },
        neutral: {
          50: "#f4f9f6",
          100: "#e9f1ec",
          200: "#dde7e1",
          300: "#c4d3cb",
          400: "#95a89e",
          500: "#6a7d73",
          600: "#51635a",
          700: "#3b4a43",
          800: "#25322c",
          900: "#16201b",
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          700: "#b45309",
          800: "#92400e",
        },
        red: {
          50: "#fef2f2",
          100: "#fee2e2",
          600: "#dc2626",
          700: "#b91c1c",
        },
        green: {
          50: "#f0fdf4",
          100: "#dcfce7",
          700: "#15803d",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgb(15 23 42 / 5%)",
        md: "0 4px 12px -2px rgb(15 23 42 / 10%), 0 2px 6px -2px rgb(15 23 42 / 6%)",
        lg: "0 12px 28px -6px rgb(15 23 42 / 16%)",
      },
    },
  },
  plugins: [],
};

export default config;

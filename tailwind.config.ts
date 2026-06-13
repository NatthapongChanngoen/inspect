import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#60a5fa", // blue-400
          DEFAULT: "#3b82f6", // blue-500
          dark: "#2563eb", // blue-600
          darker: "#1d4ed8", // blue-700
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)",
        "card-hover": "0 8px 24px rgba(16,24,40,0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;

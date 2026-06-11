import type { Config } from "tailwindcss";
const { nextui } = require("@nextui-org/react");

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // 🚀 [三大門神：視覺 CSS 變數對齊] 一勞永逸綁定，實現跨特務 0 色差與一鍵換膚！
        "brand-primary": "var(--color-primary)",
        "brand-surface": "var(--color-surface)",
        "brand-accent": "var(--color-accent)",
        "brand-text": "var(--color-text)",
      }
    }
  },
  darkMode: "class",
  plugins: [nextui()],
};
export default config;

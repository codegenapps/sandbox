import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // 🚀 [三大門神：視覺 CSS 變數對齊] 一勞永逸綁定，實現跨特務 0 色差與一鍵換膚！
        "brand-primary": "var(--color-primary)",
        "brand-on-primary": "var(--color-on-primary)",
        "brand-surface": "var(--color-surface)",
        "brand-accent": "var(--color-accent)",
        "brand-on-accent": "var(--color-on-accent)",
        "brand-text": "var(--color-text)",
      }
    }
  },
  darkMode: "class",
  plugins: [],
};
export default config;

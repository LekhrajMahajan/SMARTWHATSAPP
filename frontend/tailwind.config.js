import forms from '@tailwindcss/forms'
import containerQueries from '@tailwindcss/container-queries'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "outline": "#869584",
        "tertiary": "#ffc7b4",
        "primary-container": "#25d366",
        "on-primary": "#003915",
        "on-primary-fixed": "#002109",
        "surface-container": "#19221a",
        "secondary-fixed": "#79f9d0",
        "on-primary-fixed-variant": "#005322",
        "on-secondary": "#00382a",
        "secondary-fixed-dim": "#59dcb5",
        "on-tertiary-fixed-variant": "#763319",
        "surface-dim": "#0d150e",
        "primary": "#4ff07f",
        "primary-fixed-dim": "#3de273",
        "inverse-surface": "#dce5d8",
        "secondary": "#59dcb5",
        "surface-variant": "#2e372e",
        "on-tertiary-fixed": "#380d00",
        "tertiary-container": "#ffa07e",
        "error-container": "#93000a",
        "surface": "#0d150e",
        "surface-container-high": "#242c24",
        "tertiary-fixed": "#ffdbcf",
        "outline-variant": "#3c4a3d",
        "inverse-on-surface": "#2a332a",
        "on-secondary-fixed-variant": "#00513e",
        "on-surface": "#dce5d8",
        "surface-container-low": "#151e16",
        "on-error": "#690005",
        "background": "#0d150e",
        "on-primary-container": "#005523",
        "on-tertiary-container": "#78351b",
        "surface-container-highest": "#2e372e",
        "on-surface-variant": "#bbcbb9",
        "error": "#ffb4ab",
        "inverse-primary": "#006d2f",
        "surface-bright": "#333b33",
        "secondary-container": "#00a783",
        "on-tertiary": "#581d05",
        "on-secondary-container": "#003326",
        "surface-tint": "#3de273",
        "on-background": "#dce5d8",
        "primary-fixed": "#66ff8e",
        "surface-container-lowest": "#081009",
        "on-secondary-fixed": "#002117",
        "on-error-container": "#ffdad6",
        "tertiary-fixed-dim": "#ffb59b"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "gutter": "24px",
        "margin": "32px",
        "lg": "48px",
        "sm": "12px",
        "md": "24px",
        "base": "8px",
        "xs": "4px",
        "xl": "80px"
      },
      fontFamily: {
        "headline-md": ["Geist", "sans-serif"],
        "body-md": ["Geist", "sans-serif"],
        "headline-lg": ["Geist", "sans-serif"],
        "display": ["Geist", "sans-serif"],
        "label-sm": ["JetBrains Mono", "monospace"],
        "headline-lg-mobile": ["Geist", "sans-serif"],
        "body-lg": ["Geist", "sans-serif"]
      },
      fontSize: {
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "headline-lg": ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        "display": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "label-sm": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "500" }],
        "headline-lg-mobile": ["24px", { lineHeight: "1.2", fontWeight: "700" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }]
      }
    }
  },
  plugins: [
    forms,
    containerQueries
  ],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/portos-ai-toolkit/src/client/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'app-bg': '#0f0f0f',
        'app-card': '#1a1a1a',
        'app-border': '#2a2a2a',
        'app-accent': '#3b82f6',
        'app-success': '#22c55e',
        'app-warning': '#f59e0b',
        'app-error': '#ef4444',
      },
    },
  },
  plugins: [],
}

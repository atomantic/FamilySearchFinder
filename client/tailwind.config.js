/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/portos-ai-toolkit/src/client/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // These are now CSS variable-based for theme switching
        'app-bg': 'var(--color-app-bg)',
        'app-card': 'var(--color-app-card)',
        'app-border': 'var(--color-app-border)',
        'app-text': 'var(--color-app-text)',
        'app-text-muted': 'var(--color-app-text-muted)',
        'app-accent': '#3b82f6',
        'app-success': '#22c55e',
        'app-warning': '#f59e0b',
        'app-error': '#ef4444',
      },
    },
  },
  plugins: [],
}

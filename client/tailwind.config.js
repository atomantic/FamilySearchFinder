/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/portos-ai-toolkit/src/client/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [
    'text-app-text',
    'text-app-text-secondary',
    'text-app-text-muted',
    'text-app-text-subtle',
    'bg-app-text',
    'bg-app-text-muted',
    'border-app-text',
    'border-app-text-muted',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        // Core colors - CSS variable based for theme switching
        'app-bg': 'var(--color-app-bg)',
        'app-bg-secondary': 'var(--color-app-bg-secondary)',
        'app-card': 'var(--color-app-card)',
        'app-border': 'var(--color-app-border)',
        'app-hover': 'var(--color-app-hover)',

        // Text colors
        'app-text': 'var(--color-app-text)',
        'app-text-secondary': 'var(--color-app-text-secondary)',
        'app-text-muted': 'var(--color-app-text-muted)',
        'app-text-subtle': 'var(--color-app-text-subtle)',

        // Input colors
        'app-input-bg': 'var(--color-app-input-bg)',
        'app-input-border': 'var(--color-app-input-border)',
        'app-placeholder': 'var(--color-app-placeholder)',

        // Accent colors
        'app-accent': 'var(--color-app-accent)',
        'app-accent-hover': 'var(--color-app-accent-hover)',
        'app-accent-subtle': 'var(--color-app-accent-subtle)',

        // Status colors
        'app-success': 'var(--color-app-success)',
        'app-success-subtle': 'var(--color-app-success-subtle)',
        'app-warning': 'var(--color-app-warning)',
        'app-warning-subtle': 'var(--color-app-warning-subtle)',
        'app-error': 'var(--color-app-error)',
        'app-error-subtle': 'var(--color-app-error-subtle)',

        // Gender colors
        'app-male': 'var(--color-male)',
        'app-male-subtle': 'var(--color-male-subtle)',
        'app-female': 'var(--color-female)',
        'app-female-subtle': 'var(--color-female-subtle)',

        // Overlay
        'app-overlay': 'var(--color-app-overlay)',
      },
    },
  },
  plugins: [],
}

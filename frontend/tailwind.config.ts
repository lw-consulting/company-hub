import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #6366f1)',
          light: 'var(--color-primary-light, #818cf8)',
          dark: 'var(--color-primary-dark, #4f46e5)',
          50: 'var(--color-primary-50, #eef2ff)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary, #1e1b4b)',
          light: 'var(--color-secondary-light, #312e81)',
        },
        accent: {
          DEFAULT: 'var(--color-accent, #f59e0b)',
          light: 'var(--color-accent-light, #fbbf24)',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
        },
        border: {
          DEFAULT: '#e2e8f0',
          light: '#f1f5f9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        elevated: '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 8px 30px rgba(0,0,0,0.12)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
} satisfies Config;

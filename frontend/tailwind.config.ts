import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Kajabi-inspired: monochrome + warm accent
        primary: {
          DEFAULT: 'var(--color-primary, #1a1a1a)',
          light: 'var(--color-primary-light, #333333)',
          dark: 'var(--color-primary-dark, #000000)',
          50: 'var(--color-primary-50, #f5f5f5)',
        },
        accent: {
          DEFAULT: 'var(--color-accent, #c4956a)',
          light: 'var(--color-accent-light, #d4ab85)',
          dark: 'var(--color-accent-dark, #a87d55)',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#faf9f7',
          tertiary: '#f5f3f0',
          dark: '#1a1a1a',
        },
        muted: {
          DEFAULT: '#8a8a8a',
          light: '#b3b3b3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['2.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        'display': ['2rem', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.02em' }],
        'display-sm': ['1.5rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        elevated: '0 4px 16px rgba(0,0,0,0.06)',
        modal: '0 16px 48px rgba(0,0,0,0.12)',
        subtle: '0 0 0 1px rgba(0,0,0,0.04)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
        },
        'dark-section': 'var(--color-dark-section)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        'accent-sage': {
          DEFAULT: 'var(--color-accent-sage)',
          dark: 'var(--color-accent-sage-dark)',
          soft: 'var(--color-accent-sage-soft)',
        },
        'accent-gold': 'var(--color-accent-gold)',
        // Semantic static palettes
        sage: {
          50: '#F4F7F4',
          100: '#E6ECE6',
          200: '#CFD8CF',
          300: '#B2C4B2',
          400: '#8AA48A',
          500: '#758E75',
          600: '#5F745F',
          700: '#4A5B4A',
          800: '#344134',
          900: '#232A23',
        },
        gold: {
          500: '#C9A46A',
          600: '#B59157',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'Manrope', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      letterSpacing: {
        editorial: '0.08em',
        widest: '0.15em',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(42, 42, 42, 0.04), 0 1px 2px -1px rgba(42, 42, 42, 0.03)',
        'soft': '0 4px 20px -2px rgba(42, 42, 42, 0.06)',
        'elevated': '0 12px 32px -4px rgba(42, 42, 42, 0.10)',
        'sage': '0 4px 20px -2px rgba(138, 164, 138, 0.35)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.92', transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

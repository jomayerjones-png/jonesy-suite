/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#09090B',
          gold: '#7C3AED',
          'gold-light': '#8B5CF6',
          'gold-dark': '#6D28D9',
          'gold-muted': '#F5F3FF',
          light: '#FAFAF9',
          cream: '#EDE9FE',
          'cream-dark': '#DDD6FE',
          violet: '#7C3AED',
          indigo: '#4338CA',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(9,9,11,0.08), 0 1px 2px rgba(9,9,11,0.04)',
        'card-hover': '0 4px 12px rgba(9,9,11,0.12), 0 2px 4px rgba(9,9,11,0.06)',
        gold: '0 0 0 2px rgba(124,58,237,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
    },
  },
  plugins: [],
};

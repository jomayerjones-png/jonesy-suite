/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1A1A1A',
          gold: '#2D8A4E',
          'gold-light': '#3DA564',
          'gold-dark': '#1E6B38',
          'gold-muted': '#A8DEB8',
          light: '#F0F5F1',
          cream: '#E0EBE3',
          'cream-dark': '#D0DED4',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,26,26,0.08), 0 1px 2px rgba(26,26,26,0.04)',
        'card-hover': '0 4px 12px rgba(26,26,26,0.12), 0 2px 4px rgba(26,26,26,0.06)',
        gold: '0 0 0 2px rgba(45,138,78,0.3)',
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

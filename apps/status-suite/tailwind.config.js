/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0A0A0A',
          gold: '#FFE500',
          'gold-light': '#FFF176',
          'gold-dark': '#F9C800',
          'gold-muted': '#FFFDE7',
          light: '#FAFAFA',
          cream: '#F0F0F0',
          'cream-dark': '#E0E0E0',
          'status-yellow': '#FFE500',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(10,10,10,0.08), 0 1px 2px rgba(10,10,10,0.04)',
        'card-hover': '0 4px 12px rgba(10,10,10,0.12), 0 2px 4px rgba(10,10,10,0.06)',
        gold: '0 0 0 2px rgba(255,229,0,0.4)',
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

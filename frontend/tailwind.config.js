/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          primary:  '#2E7D32',
          dark:     '#1b5e20',
          light:    '#A5D6A7',
          mid:      '#43a047',
        },
        orange: {
          primary: '#FFA726',
          dark:    '#e65100',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.14)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
}

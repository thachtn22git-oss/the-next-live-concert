/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        concert: {
          sky: '#7CCBF3',
          lightBlue: '#B5E3FA',
          mint: '#C9FFC8',
          yellow: '#FFD92F',
          orange: '#FF865C',
          cyan: '#23D4D8',
          pink: '#FF3366',
          black: '#080808',
          white: '#FFFFFF',
        },
      },
      boxShadow: {
        pop: '6px 6px 0 #080808',
        'pop-sm': '3px 3px 0 #080808',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        pop: '1.25rem',
      },
    },
  },
  plugins: [],
};

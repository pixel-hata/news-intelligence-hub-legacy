import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17202a',
        line: '#d8dee8',
        paper: '#f7f8fb',
      },
    },
  },
} satisfies Config;

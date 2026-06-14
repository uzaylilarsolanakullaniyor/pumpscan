import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Koyu tema temel renkleri
        base: '#0b0e14',
        surface: '#141925',
        border: '#222a3a',
      },
    },
  },
  plugins: [],
};

export default config;

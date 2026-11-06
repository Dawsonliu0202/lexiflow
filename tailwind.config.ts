import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{html,ts,vue}',
    './components/**/*.{html,ts,vue}',
  ],
  theme: {
    extend: {
      colors: {
        lexi: {
          bg: '#f7f7f5',
          surface: '#ffffff',
          line: '#e8e8e4',
          line2: '#f0f0ec',
          text: '#1c1c1a',
          text2: '#5f5f5a',
          text3: '#97978f',
          accent: '#3b4cca',
          'accent-h': '#2f3eaa',
          'accent-soft': '#eef0fb',
          ok: '#2f7d57',
          'ok-bg': '#e8f3ed',
          warn: '#9a6a14',
          'warn-bg': '#faf1de',
          err: '#b3382c',
          'err-bg': '#fbebe9',
          info: '#2e5fa8',
          'info-bg': '#e8f0fa',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,10,0.04), 0 4px 16px rgba(20,20,10,0.05)',
        'card-lg': '0 12px 40px rgba(20,20,10,0.14), 0 2px 6px rgba(20,20,10,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;

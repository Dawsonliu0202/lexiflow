const remToPx = () => ({
  postcssPlugin: 'postcss-rem-to-pixel',
  Declaration(decl) {
    if (decl.value && decl.value.includes('rem')) {
      decl.value = decl.value.replace(/(\d*\.?\d+)rem/g, (_, val) => {
        const px = Math.round(parseFloat(val) * 16 * 100) / 100;
        return `${px}px`;
      });
    }
  },
});
remToPx.postcss = true;

module.exports = {
  plugins: [
    require('tailwindcss'),
    remToPx,
    require('autoprefixer'),
  ],
};

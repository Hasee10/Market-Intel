// Added for the Chakra -> Tailwind migration (spike). Tailwind 4 ships its
// PostCSS integration as a separate package; this is the whole config it
// needs - no tailwind.config.js, since v4 is configured from CSS (@theme in
// src/styles/tailwind.css) rather than a JS config file.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;

import next from 'eslint-config-next';

const config = [
  ...next,
  {
    rules: {
      // Campaign media is user-supplied from arbitrary hosts; plain <img> avoids remotePatterns config.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'scripts/**'] },
];

export default config;

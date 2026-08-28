module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind', worklets: false }], 'nativewind/babel'],
    plugins: [
      ['module:react-native-dotenv'],
      // Reanimated 4 moved the worklet transform into react-native-worklets.
      // `react-native-reanimated/plugin` is a deprecated re-export of this.
      // MUST BE LAST.
      'react-native-worklets/plugin',
    ],
    env: {
      // console.* still executes in release Hermes builds, and there are ~130
      // of them across the app. Stripped at build time rather than policed by
      // review.
      production: {
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};

export default {
  stories: ['../src/components/ai/**/*.stories.@(js|jsx)', '../src/features/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  }
};

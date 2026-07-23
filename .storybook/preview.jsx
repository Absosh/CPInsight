import '../src/components/ai/ai-components.css';
import { AiThemeProvider } from '../src/components/ai/index.js';

export const decorators = [
  (Story, context) => (
    <AiThemeProvider mode={context.globals.theme || 'dark'}>
      <Story />
    </AiThemeProvider>
  )
];

export const globalTypes = {
  theme: {
    name: 'Theme',
    defaultValue: 'dark',
    toolbar: {
      icon: 'circlehollow',
      items: ['dark', 'light', 'highContrast']
    }
  }
};

export const parameters = {
  a11y: {
    test: 'error'
  },
  controls: {
    expanded: true
  }
};

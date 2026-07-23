# Storybook

Storybook is configured for the AI Design System under `.storybook/`.

## Commands

```powershell
npm install
npm run storybook
npm run build-storybook
```

`npm install` is required because the repository historically used static frontend files and did not previously include a root React workspace.

## Story Coverage

`src/components/ai/stories/AIComponents.stories.jsx` includes stories for:

- core components;
- composite components;
- streaming state;
- dark, light, and high-contrast themes through the Storybook toolbar;
- layout patterns.

The a11y addon is configured for interactive accessibility checks. Visual regression should be added in CI after the frontend build pipeline is formalized.

# AI Design System Accessibility

The AI Design System is built for keyboard, screen reader, reduced motion, and high-contrast use.

## Implemented Requirements

| Requirement | Implementation |
| --- | --- |
| Keyboard focus | `ai-focusable` and `:focus-visible` styling |
| ARIA labels | Interactive icon and status components include labels |
| Screen readers | Validation and streaming regions use appropriate live-region behavior |
| Reduced motion | CSS honors `prefers-reduced-motion` |
| High contrast | `highContrast` semantic theme |
| Accessible color | Components consume semantic tokens with explicit contrast intent |
| Stable dimensions | Cards, buttons, chips, icons, and progress tracks use stable dimensions |

## Authoring Rules

- Do not use color as the only signal; pair confidence colors with text and percentages.
- Use buttons for actions, not clickable divs.
- Keep expandable evidence in native `details` elements unless a more advanced disclosure component is required.
- Use `aria-label` for icon-only controls.
- Preserve focus order when composing docked panels and split views.
- Test reduced motion before shipping new animation classes.

## Verification

Storybook includes the a11y addon in `.storybook/main.js`. The static verifier checks for focus-visible styling and reduced-motion CSS.

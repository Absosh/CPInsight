# AI Design Tokens

AI design tokens live in `src/components/ai/tokens/designTokens.js`. Components consume semantic variables from the theme layer rather than hardcoding colors.

## Token Groups

| Group | Purpose |
| --- | --- |
| Spacing | Layout rhythm and internal component spacing |
| Border radius | Cards, buttons, chips, and pills |
| Elevation | Raised surfaces, floating panels, and focus rings |
| Glass blur | Overlay and panel blur values |
| Typography | Font family, sizes, line heights, and weights |
| Semantic colors | Theme-specific surface, border, text, and status values |
| Confidence colors | Low, medium, high, and verified confidence states |
| Evidence colors | Evidence-first accents |
| Recommendation colors | Recommendation and action accents |
| Warning colors | Partial, uncertain, or risky states |
| Success colors | Validated and completed states |
| Behavior colors | Behavioral profile and ontology accents |
| Reflection colors | Reflection timeline and memory accents |
| Status colors | Loading, streaming, success, empty, partial, error, retry, offline |
| Motion curves | Shared animation timing and easing |
| Icon sizes | Stable icon dimensions |
| Breakpoints | Mobile, tablet, desktop, and wide layouts |

## Semantic Consumption

CSS uses variables such as:

```css
--ai-surface
--ai-surface-raised
--ai-border
--ai-text
--ai-evidence
--ai-recommendation
--ai-reflection
--ai-focus-ring
```

This allows dark, light, high-contrast, and future custom themes to share component implementations.

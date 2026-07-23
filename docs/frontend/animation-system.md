# AI Animation System

Animations live in `src/components/ai/theme/ai-theme.css`, `src/components/ai/ai-components.css`, and `src/components/ai/animations/animationClasses.js`.

## Animation Types

| Animation | Class |
| --- | --- |
| Streaming text | `ai-streaming-cursor` |
| Card reveal | `ai-reveal` |
| Evidence expansion | `ai-evidence-expansion` |
| Timeline growth | `ai-timeline-growth` |
| Progress updates | `ai-progress-track` |
| Confidence pulse | `ai-confidence-pulse` |
| Hover elevation | `ai-card[data-interactive="true"]` |
| Skeleton loading | `ai-skeleton` |
| Smooth layout transition | `ai-layout-transition` |

## Motion Rules

- Motion duration and easing come from tokens.
- Progress and confidence changes should animate but not shift layout.
- Loading states use skeletons rather than text-only placeholders.
- Hover elevation is subtle and does not resize components.
- Reduced motion is honored with `prefers-reduced-motion`.

## Reduced Motion

The CSS disables long-running animations and transitions when users request reduced motion. Components should not add inline animation declarations that bypass this rule.

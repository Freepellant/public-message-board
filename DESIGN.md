# Design Brief

## Tone & Direction
Brutalist simplicity. Refined restraint over decoration. Editorial clarity with strong structural hierarchy. Every element has a clear purpose—no visual noise.

## Color Palette

| Token | Light (OKLCH) | Dark (OKLCH) | Purpose |
|-------|---|---|---|
| Primary | 0.5 0.12 250 | 0.75 0.15 250 | Slate blue, neutral & trustworthy |
| Accent | 0.65 0.18 30 | 0.72 0.20 40 | Warm orange, CTAs & highlights |
| Neutral/Muted | 0.92 0 0 | 0.25 0 0 | Backgrounds, subtle dividers |
| Destructive | 0.55 0.22 25 | 0.65 0.19 22 | Actions requiring attention |

## Typography
- **Display**: General Sans (modern, clean sans-serif)
- **Body**: General Sans (consistent, refined)
- **Mono**: Geist Mono (code/data)
- Scale: 12px base, 14px body, 16px large, 18px heading, 20px title

## Structural Zones
| Zone | Treatment | Notes |
|------|-----------|-------|
| Header | Minimal title + `border-b` divider | Soft grey border, large padding |
| Form Area | Elevated card (`bg-card`, `border`, `shadow-sm`) on `bg-background` | Clear input states |
| Message List | Individual cards in flow layout | Each card: `bg-card`, `border`, 12px text, timestamp in muted |
| Message Item | Sender name (bold, 14px), content, timestamp (muted, 12px) | Vertical spacing for rhythm |

## Shape Language
- Border radius: Minimal (4px on inputs, 0px on cards)
- Shadows: Only `shadow-sm` for card elevation
- Spacing: 8px base unit—8, 16, 24, 32px increments

## Component Patterns
- **Form inputs**: `bg-input`, `border border-border`, 8px padding, minimal radius
- **Buttons**: CTA uses `bg-accent text-accent-foreground`, normal uses `bg-primary text-primary-foreground`
- **Message card**: `bg-card border border-border p-4`, no shadow decoration
- **Focus states**: `ring-2 ring-ring ring-offset-2`

## Motion & Transitions
- Default transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- No entrance animations—content appears instantly
- Hover states: 50ms color shift on interactive elements

## Theme
Light theme primary (respects `prefers-color-scheme` for dark mode fallback).

## Signature Detail
Clean grid-based layout with intentional whitespace. No CSS decoration—visual hierarchy through scale, weight, and spacing alone.

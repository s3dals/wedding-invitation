/**
 * Ready-made palettes for the Style page.
 *
 * They exist because four hex inputs are not how anyone chooses a wedding
 * palette - the pickers have been there a while and every invitation is still
 * on Bootstrap's default blue. Tapping one fills the inputs; nothing is locked
 * afterwards.
 *
 * Every palette is checked against WCAG: text on background clears AAA (7:1)
 * and the button label clears AA (4.5:1), given the label colour that
 * custom-theme.js derives. Keep new entries to that standard.
 */
export const themePresets = [
    {
        name: 'Ivory & Rose',
        primary: '#b76e79',
        secondary: '#8c7b75',
        background: '#fdf6f0',
        text: '#4a3b3b',
    },
    {
        name: 'Sage & Cream',
        primary: '#5f7d58',
        secondary: '#7a806f',
        background: '#f6f5ef',
        text: '#33413a',
    },
    {
        name: 'Classic Navy',
        primary: '#2c3e66',
        secondary: '#5b6472',
        background: '#ffffff',
        text: '#1f2a44',
    },
    {
        name: 'Desert Sand',
        primary: '#a9723a',
        secondary: '#8a7355',
        background: '#faf3e8',
        text: '#4b3b2a',
    },
    {
        name: 'Midnight Gold',
        primary: '#c9a227',
        secondary: '#b3a6b0',
        background: '#1a1a2e',
        text: '#eaeaea',
    },
    {
        name: 'Deep Emerald',
        primary: '#3fae83',
        secondary: '#9ab8ac',
        background: '#10241d',
        text: '#e8f0ec',
    },
];

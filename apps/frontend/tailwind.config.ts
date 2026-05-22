import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/**
 * Tailwind config alineado 1:1 con el export Stitch (apps/frontend/stitch-exports/)
 * y con el design system en apps/frontend/DESIGN.md.
 * Cualquier token que aparezca en los screens generados por Stitch debe existir acá
 * para que el HTML se renderice idéntico.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // PeaKu design system (DESIGN.md)
        background: '#FAFAF7',
        foreground: '#1A1F1B',
        card: '#FFFFFF',
        primary: '#005226',
        'primary-container': '#1F6B3A',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#9CE9AB',
        'primary-fixed': '#a7f4b6',
        'primary-fixed-dim': '#8cd79b',
        'on-primary-fixed': '#00210c',
        'on-primary-fixed-variant': '#005226',
        'inverse-primary': '#8cd79b',
        accent: '#E8A33D',
        secondary: '#5f5f59',
        'on-secondary': '#ffffff',
        'secondary-container': '#e1e0d8',
        'on-secondary-container': '#63635d',
        'secondary-fixed': '#e4e2db',
        'secondary-fixed-dim': '#c8c7bf',
        'on-secondary-fixed': '#1b1c17',
        'on-secondary-fixed-variant': '#474741',
        muted: '#EFEDE5',
        'muted-foreground': '#5C6358',
        destructive: '#A33A2A',
        border: '#D9D6CC',
        // Material 3 surface tokens (usados por el export Stitch)
        surface: '#f7faf3',
        'surface-bright': '#f7faf3',
        'surface-dim': '#d7dbd4',
        'surface-tint': '#206c3b',
        'surface-variant': '#e0e4dc',
        'surface-container': '#ebefe8',
        'surface-container-low': '#f1f5ed',
        'surface-container-lowest': '#ffffff',
        'surface-container-high': '#e6e9e2',
        'surface-container-highest': '#e0e4dc',
        'on-surface': '#181d18',
        'on-surface-variant': '#404940',
        'on-background': '#181d18',
        'inverse-surface': '#2d322d',
        'inverse-on-surface': '#eef2eb',
        outline: '#707a6f',
        'outline-variant': '#bfc9bd',
        tertiary: '#772c3b',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#954352',
        'on-tertiary-container': '#ffcad0',
        'tertiary-fixed': '#ffd9dd',
        'tertiary-fixed-dim': '#ffb2bc',
        'on-tertiary-fixed': '#3f0113',
        'on-tertiary-fixed-variant': '#792d3c',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        'section-py-desktop': '80px',
        'section-py-mobile': '48px',
        'gap-default': '24px',
        'form-column': '480px',
        'reading-column': '680px',
        'container-max': '1280px',
      },
      maxWidth: {
        'form-column': '480px',
        'reading-column': '680px',
        'container-max': '1280px',
      },
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        'body-sm': ['Inter', 'system-ui', 'sans-serif'],
        h2: ['Manrope', 'system-ui', 'sans-serif'],
        h3: ['Manrope', 'system-ui', 'sans-serif'],
        'display-xl': ['Manrope', 'system-ui', 'sans-serif'],
        'display-lg': ['Manrope', 'system-ui', 'sans-serif'],
        'display-md': ['Manrope', 'system-ui', 'sans-serif'],
        'label-eyebrow': ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        body: ['15px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        h2: ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'display-xl': [
          '56px',
          { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        'display-lg': [
          '40px',
          { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' },
        ],
        'display-md': [
          '28px',
          { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        'label-eyebrow': [
          '11px',
          { lineHeight: '1.4', letterSpacing: '0.14em', fontWeight: '600' },
        ],
        mono: ['13px', { fontWeight: '500' }],
      },
    },
  },
  plugins: [forms, containerQueries],
};

export default config;

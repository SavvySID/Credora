/** @type {import('tailwindcss').Config} */

// Colors resolve through CSS variables (space-separated RGB channels) so a single
// `.dark` class on <html> re-themes the whole system while keeping Tailwind's
// opacity modifiers working, e.g. `bg-surface/80`.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: v('canvas'),
          sunken: v('canvas-sunken'),
          raised: v('canvas-raised'),
        },
        surface: {
          DEFAULT: v('surface'),
          muted: v('surface-muted'),
          inset: v('surface-inset'),
        },
        hairline: {
          DEFAULT: v('hairline'),
          strong: v('hairline-strong'),
          soft: v('hairline-soft'),
        },
        ink: {
          DEFAULT: v('ink'),
          muted: v('ink-muted'),
          soft: v('ink-soft'),
          faint: v('ink-faint'),
          inverse: v('ink-inverse'),
        },

        // Credora brand. Steps 100–500 and 950 are fixed hues: they sit on the deep
        // brand panel, which stays dark in both themes. Steps 50 and 600–900 flip,
        // because they carry tinted backgrounds and text that must invert.
        brand: {
          50: v('brand-50'),
          100: '#D6F5F7',
          200: '#AFEAEF',
          300: '#7BD9E2',
          400: '#3FC0CE',
          500: '#16A2B4',
          600: v('brand-600'),
          700: v('brand-700'),
          800: v('brand-800'),
          900: v('brand-900'),
          950: '#062A35',
        },

        // Solid brand surfaces: primary actions and the deep hero panels.
        brandsolid: {
          DEFAULT: v('brandsolid'),
          hover: v('brandsolid-hover'),
          fg: v('brandsolid-fg'),
        },
        brandpanel: v('brandpanel'),
        edge: { brand: v('edge-brand') },

        positive: {
          50: v('positive-50'),
          100: v('positive-100'),
          500: v('positive-500'),
          600: v('positive-600'),
          700: v('positive-700'),
        },
        caution: {
          50: v('caution-50'),
          100: v('caution-100'),
          500: v('caution-500'),
          600: v('caution-600'),
          700: v('caution-700'),
        },
        critical: {
          50: v('critical-50'),
          100: v('critical-100'),
          500: v('critical-500'),
          600: v('critical-600'),
          700: v('critical-700'),
        },
        info: {
          50: v('info-50'),
          100: v('info-100'),
          500: v('info-500'),
          600: v('info-600'),
          700: v('info-700'),
        },

        // Data-visualisation ramp. Fixed mid-tones that stay legible on both canvases.
        viz: {
          1: '#0D8298',
          2: '#16A2B4',
          3: '#3FC0CE',
          4: '#7BD9E2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        'display-sm': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        'display-md': ['2.25rem', { lineHeight: '2.625rem', letterSpacing: '-0.025em' }],
        'display-lg': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.03em' }],
        'display-xl': ['3.75rem', { lineHeight: '4rem', letterSpacing: '-0.035em' }],
        // Fluid hero size. The two-column hero gives the headline a narrow column,
        // so a fixed step overflows in the 1024–1200px band; this scales instead.
        'display-hero': [
          'clamp(2.25rem, 0.75rem + 4vw, 3.75rem)',
          { lineHeight: '1.06', letterSpacing: '-0.035em' },
        ],
      },
      borderRadius: {
        card: '1rem',
        panel: '1.375rem',
      },
      boxShadow: {
        hairline: '0 0 0 1px rgb(var(--hairline))',
        card: '0 1px 2px rgb(var(--shadow-color) / var(--shadow-a1)), 0 6px 16px -8px rgb(var(--shadow-color) / var(--shadow-a2))',
        raised:
          '0 2px 4px rgb(var(--shadow-color) / var(--shadow-a1)), 0 14px 32px -12px rgb(var(--shadow-color) / var(--shadow-a3))',
        pop: '0 8px 12px -6px rgb(var(--shadow-color) / var(--shadow-a2)), 0 24px 56px -20px rgb(var(--shadow-color) / var(--shadow-a4))',
        inset: 'inset 0 1px 2px rgb(var(--shadow-color) / var(--shadow-a1))',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.3s ease both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}

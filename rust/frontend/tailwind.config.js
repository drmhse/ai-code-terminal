/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],

  // Important: Don't purge your design system classes
  safelist: [
    // Preserve icon utility classes
    'icon-xs', 'icon-sm', 'icon-base', 'icon-md', 'icon-lg', 'icon-xl', 'icon-2xl',
  ],

  theme: {
    extend: {
      // ===== DESIGN TOKEN INTEGRATION =====
      // Map Tailwind utilities to your existing CSS custom properties
      // This ensures Tailwind utilities automatically respect theme changes

      colors: {
        // Background colors - maps to your design tokens
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          quaternary: 'var(--color-bg-quaternary)',
          overlay: 'var(--color-bg-overlay)',
        },

        // Text colors
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },

        // Border colors
        border: {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          focus: 'var(--color-border-focus)',
          hover: 'var(--color-border-hover)',
        },

        // Interactive colors
        interactive: {
          primary: 'var(--color-interactive-primary)',
          'primary-hover': 'var(--color-interactive-primary-hover)',
          'primary-active': 'var(--color-interactive-primary-active)',
          'primary-disabled': 'var(--color-interactive-primary-disabled)',
          secondary: 'var(--color-interactive-secondary)',
          'secondary-hover': 'var(--color-interactive-secondary-hover)',
          tertiary: 'var(--color-interactive-tertiary)',
          'tertiary-hover': 'var(--color-interactive-tertiary-hover)',
          link: 'var(--color-interactive-link)',
          'link-hover': 'var(--color-interactive-link-hover)',
          'link-visited': 'var(--color-interactive-link-visited)',
        },

        // Semantic colors
        semantic: {
          success: 'var(--color-semantic-success)',
          'success-bg': 'var(--color-semantic-success-bg)',
          'success-border': 'var(--color-semantic-success-border)',
          warning: 'var(--color-semantic-warning)',
          'warning-bg': 'var(--color-semantic-warning-bg)',
          'warning-border': 'var(--color-semantic-warning-border)',
          error: 'var(--color-semantic-error)',
          'error-bg': 'var(--color-semantic-error-bg)',
          'error-border': 'var(--color-semantic-error-border)',
          info: 'var(--color-semantic-info)',
          'info-bg': 'var(--color-semantic-info-bg)',
          'info-border': 'var(--color-semantic-info-border)',
        },
      },

      // Spacing scale - maps to your design tokens
      spacing: {
        '1': 'var(--space-1)',   // 4px
        '2': 'var(--space-2)',   // 8px
        '3': 'var(--space-3)',   // 12px
        '4': 'var(--space-4)',   // 16px
        '5': 'var(--space-5)',   // 20px
        '6': 'var(--space-6)',   // 24px
        '8': 'var(--space-8)',   // 32px
        '10': 'var(--space-10)', // 40px
        '12': 'var(--space-12)', // 48px
        '16': 'var(--space-16)', // 64px
        '20': 'var(--space-20)', // 80px
        '24': 'var(--space-24)', // 96px
      },

      // Typography - maps to your font tokens
      fontFamily: {
        sans: 'var(--font-family-sans)',
        mono: 'var(--font-family-mono)',
        brand: 'var(--font-family-brand)',
      },

      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
      },

      fontWeight: {
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
      },

      lineHeight: {
        tight: 'var(--line-height-tight)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)',
      },

      // Border radius - maps to your radius tokens
      borderRadius: {
        sm: 'var(--radius-sm)',
        base: 'var(--radius-base)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      // Box shadows - maps to your shadow tokens
      boxShadow: {
        sm: 'var(--shadow-sm)',
        base: 'var(--shadow-base)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },

      // Transitions - maps to your motion tokens
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
        smooth: 'var(--transition-smooth)',
        slow: 'var(--transition-slow)',
        spring: 'var(--transition-spring)',
      },

      // Z-index scale
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        fixed: 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
        toast: 'var(--z-toast)',
      },

      // Component-specific tokens
      height: {
        'btn-sm': 'var(--button-height-sm)',
        'btn-base': 'var(--button-height-base)',
        'btn-lg': 'var(--button-height-lg)',
        'input-sm': 'var(--input-height-sm)',
        'input-base': 'var(--input-height-base)',
        'input-lg': 'var(--input-height-lg)',
      }
    },
  },

  plugins: [
    // Useful plugins for forms and typography
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@tailwindcss/forms')({
      strategy: 'class', // Use .form-input instead of styling all inputs
    }),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@tailwindcss/typography'),

    // Custom plugin to add component utilities that respect your design tokens
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function({ addUtilities, theme }) {
      addUtilities({
        // Button utilities that use your design tokens
        '.btn-base': {
          'display': 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'gap': 'var(--space-2)',
          'height': 'var(--button-height-base)',
          'padding': '0 var(--button-padding-x-base)',
          'font-size': 'var(--button-font-size-base)',
          'font-weight': 'var(--button-font-weight)',
          'border-radius': 'var(--button-border-radius)',
          'border': '1px solid transparent',
          'cursor': 'pointer',
          'transition': 'var(--transition-base)',
          'user-select': 'none',
        },

        '.btn-primary': {
          'background': 'var(--color-interactive-primary)',
          'border-color': 'var(--color-interactive-primary)',
          'color': 'var(--color-text-inverse)',
          '&:hover': {
            'background': 'var(--color-interactive-primary-hover)',
            'border-color': 'var(--color-interactive-primary-hover)',
          }
        },

        '.btn-secondary': {
          'background': 'var(--color-bg-tertiary)',
          'border-color': 'var(--color-border-primary)',
          'color': 'var(--color-text-primary)',
          '&:hover': {
            'background': 'var(--color-interactive-tertiary-hover)',
            'border-color': 'var(--color-border-hover)',
          }
        },

        // Input utilities
        '.input-base': {
          'height': 'var(--input-height-base)',
          'padding': '0 var(--input-padding-x)',
          'background': 'var(--color-input-background)',
          'border': 'var(--input-border-width) solid var(--color-input-border)',
          'border-radius': 'var(--input-border-radius)',
          'color': 'var(--color-input-text)',
          'font-size': 'var(--input-font-size)',
          'transition': 'var(--transition-base)',
          '&:focus': {
            'outline': 'none',
            'border-color': 'var(--color-input-border-focus)',
            'background': 'var(--color-input-background-focus)',
          },
          '&::placeholder': {
            'color': 'var(--color-input-placeholder)',
          }
        },

        // Icon size utilities that use design tokens
        '.icon-xs': {
          'width': 'var(--space-2)',   // 8px - for very small icons
          'height': 'var(--space-2)',
          'flex-shrink': '0',
        },
        '.icon-sm': {
          'width': 'var(--space-3)',   // 12px - for small icons
          'height': 'var(--space-3)',
          'flex-shrink': '0',
        },
        '.icon-base': {
          'width': 'var(--space-4)',   // 16px - for normal icons
          'height': 'var(--space-4)',
          'flex-shrink': '0',
        },
        '.icon-md': {
          'width': 'var(--space-5)',   // 20px - for medium icons
          'height': 'var(--space-5)',
          'flex-shrink': '0',
        },
        '.icon-lg': {
          'width': 'var(--space-6)',   // 24px - for large icons
          'height': 'var(--space-6)',
          'flex-shrink': '0',
        },
        '.icon-xl': {
          'width': 'var(--space-8)',   // 32px - for extra large icons
          'height': 'var(--space-8)',
          'flex-shrink': '0',
        },
        '.icon-2xl': {
          'width': 'var(--space-12)',  // 48px - for hero/banner icons
          'height': 'var(--space-12)',
          'flex-shrink': '0',
        }
      })
    }
  ],
}
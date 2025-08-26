---
title: "Theme System"
description: "Comprehensive theming system with customizable color schemes and predefined themes"
weight: 60
layout: "docs"
---

# Theme System

AI Code Terminal features a comprehensive theme system that allows users to customize the visual appearance of the interface and terminal for optimal development experience.

## Theme Architecture

The theme system is built with a modular architecture supporting:

- **Predefined Themes:** Curated collection of popular development themes
- **Custom Themes:** User-defined color schemes and configurations
- **Real-time Updates:** Instant theme switching without page reload
- **Persistent Storage:** Theme preferences saved per user
- **Terminal Integration:** Synchronized terminal and UI theming

## Available Themes

### Popular Predefined Themes

**VS Code Dark**
- Modern dark theme inspired by Visual Studio Code
- Optimized for extended coding sessions
- High contrast for better readability

**GitHub Light**
- Clean light theme following GitHub's design language
- Professional appearance for presentation environments
- Excellent for daytime development

**Monokai**
- Classic developer favorite with vibrant syntax highlighting
- High contrast color palette
- Excellent for code readability

**Dracula**
- Popular dark theme with purple accents
- Carefully selected color palette
- Reduces eye strain during night coding

### Theme Components

Each theme includes comprehensive styling for:

#### Interface Colors
- **Primary Colors:** Background, surface, and container colors
- **Text Colors:** Primary and secondary text with proper contrast
- **Accent Colors:** Success, warning, error, and info states
- **Border Colors:** Subtle borders and dividers

#### Terminal Colors
- **Background:** Terminal background color
- **Foreground:** Default text color
- **Cursor:** Cursor color and style
- **Selection:** Text selection highlighting
- **ANSI Colors:** Full 16-color palette for terminal output

#### Typography
- **Primary Font:** System UI fonts for interface elements
- **Monospace Font:** Code and terminal fonts with proper spacing
- **Font Sizes:** Responsive typography scaling

## Theme Management

### Theme Selection
Users can switch themes through:
- Settings modal in the user interface
- Theme picker with live preview
- API endpoints for programmatic theme changes
- Real-time synchronization across all open sessions

### Theme Persistence
- Theme preferences automatically saved to user settings
- Synchronized across all devices and sessions
- Restored on login and page refresh
- Database-backed storage for reliability

### Custom Theme Creation

#### Theme Structure
```json
{
  "name": "Custom Theme",
  "type": "dark",
  "colors": {
    "primary": "#1e1e1e",
    "secondary": "#252526",
    "tertiary": "#2d2d30",
    "sidebar": "#181818",
    "border": "#3c3c3c",
    "textPrimary": "#cccccc",
    "textSecondary": "#969696",
    "success": "#4caf50",
    "warning": "#ff9800",
    "error": "#f44336"
  },
  "terminal": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "cursor": "#007acc",
    "selection": "#264f78",
    "ansiColors": {
      "black": "#000000",
      "red": "#cd3131",
      "green": "#0dbc79",
      "yellow": "#e5e510",
      "blue": "#2472c8",
      "magenta": "#bc3fbc",
      "cyan": "#11a8cd",
      "white": "#e5e5e5"
    }
  }
}
```

#### Theme Validation
- Automatic color contrast validation
- Accessibility compliance checking
- Color scheme harmony analysis
- Terminal compatibility verification

## API Integration

### Theme Endpoints

**Get Current Theme**
```javascript
GET /api/theme
```

**Update Theme**
```javascript
POST /api/theme
{
  "theme": {
    "name": "VS Code Dark",
    "type": "dark",
    "colors": { ... }
  }
}
```

**List Available Themes**
```javascript
GET /api/themes
```

**Get Specific Theme**
```javascript
GET /api/themes/:themeId
```

### Frontend Integration

#### Vue.js Theme Management
```javascript
// Theme switching in the Vue.js application
methods: {
  async switchTheme(themeName) {
    try {
      await this.$http.post('/api/theme', {
        theme: this.availableThemes[themeName]
      });
      this.applyTheme(themeName);
    } catch (error) {
      console.error('Theme switch failed:', error);
    }
  },

  applyTheme(themeName) {
    const theme = this.availableThemes[themeName];
    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Update terminal theme
    if (this.terminal) {
      this.terminal.setOption('theme', theme.terminal);
    }
  }
}
```

#### CSS Custom Properties
```css
:root {
  --color-primary: #1e1e1e;
  --color-secondary: #252526;
  --color-text-primary: #cccccc;
  --color-border: #3c3c3c;
}

.sidebar {
  background-color: var(--color-primary);
  border-color: var(--color-border);
  color: var(--color-text-primary);
}
```

## Terminal Theme Integration

### xterm.js Configuration
The theme system integrates with xterm.js for consistent terminal styling:

```javascript
// Terminal theme application
terminal.setOption('theme', {
  background: theme.terminal.background,
  foreground: theme.terminal.foreground,
  cursor: theme.terminal.cursor,
  selection: theme.terminal.selection,
  black: theme.terminal.ansiColors.black,
  red: theme.terminal.ansiColors.red,
  green: theme.terminal.ansiColors.green,
  yellow: theme.terminal.ansiColors.yellow,
  blue: theme.terminal.ansiColors.blue,
  magenta: theme.terminal.ansiColors.magenta,
  cyan: theme.terminal.ansiColors.cyan,
  white: theme.terminal.ansiColors.white
});
```

### Color Scheme Synchronization
- Terminal colors automatically sync with interface theme
- ANSI color mapping for consistent syntax highlighting  
- Cursor and selection colors matched to theme accent
- Real-time updates without terminal restart

## Accessibility Features

### High Contrast Support
- Automatic contrast ratio validation
- WCAG 2.1 AA compliance
- Color blindness considerations
- Alternative text indicators

### Responsive Design
- Theme scaling for different screen sizes
- Mobile-optimized color schemes
- Adaptive font sizing
- Touch-friendly interface elements

### User Preferences
- System theme detection (dark/light mode)
- User preference persistence
- Accessibility override options
- Custom contrast settings

## Development and Testing

### Theme Development Workflow
1. **Design:** Create color palette and theme structure
2. **Implementation:** Define theme JSON configuration
3. **Testing:** Validate across different components
4. **Integration:** Add to theme registry
5. **Deployment:** Make available through API

### Theme Testing
- Visual regression testing for theme consistency
- Cross-browser compatibility validation
- Terminal color accuracy verification
- Accessibility compliance checking

### Performance Optimization
- Lazy loading of theme assets
- CSS custom property optimization
- Minimal reflow theme switching
- Cached theme configurations

## Future Enhancements

### Planned Features
- **Theme Marketplace:** Community-contributed themes
- **Advanced Customization:** Per-workspace theme settings
- **Import/Export:** Theme sharing and backup
- **AI-Generated Themes:** Automatic color scheme generation
- **Seasonal Themes:** Time-based theme switching
- **Syntax-Aware Theming:** Language-specific color schemes

The theme system continues to evolve based on user feedback and modern development practices, ensuring an optimal visual experience for all users.
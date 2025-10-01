# Keyboard Shortcuts

This document describes all available keyboard shortcuts in the code editor. The editor is powered by CodeMirror 6, which provides extensive keyboard support out of the box.

## Platform Key Notation

- **Ctrl** = Control key on Windows/Linux
- **Cmd** = Command key on macOS
- **Mod** = Automatically uses Ctrl on Windows/Linux, Cmd on macOS

## File Operations

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Save File | `Ctrl+S` | `Cmd+S` | Save the current file |
| Save All Files | `Ctrl+Shift+S` | `Cmd+Shift+S` | Save all open files |
| Close File | `Ctrl+W` | `Cmd+W` | Close the current file tab |

## Editing

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Undo | `Ctrl+Z` | `Cmd+Z` | Undo the last change |
| Redo | `Ctrl+Shift+Z` or `Ctrl+Y` | `Cmd+Shift+Z` | Redo the last undone change |
| Copy | `Ctrl+C` | `Cmd+C` | Copy selected text |
| Cut | `Ctrl+X` | `Cmd+X` | Cut selected text |
| Paste | `Ctrl+V` | `Cmd+V` | Paste from clipboard |
| Select All | `Ctrl+A` | `Cmd+A` | Select entire document |
| Delete Line | `Ctrl+D` | `Cmd+D` | Delete current line |
| Move Line Up | `Alt+Up` | `Option+Up` | Move current line up |
| Move Line Down | `Alt+Down` | `Option+Down` | Move current line down |

## Navigation

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Go to Start | `Ctrl+Home` | `Cmd+Up` | Jump to document start |
| Go to End | `Ctrl+End` | `Cmd+Down` | Jump to document end |
| Go to Line Start | `Home` | `Cmd+Left` | Jump to line start |
| Go to Line End | `End` | `Cmd+Right` | Jump to line end |
| Page Up | `PageUp` | `PageUp` | Scroll up one page |
| Page Down | `PageDown` | `PageDown` | Scroll down one page |

## Search and Replace

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Find | `Ctrl+F` | `Cmd+F` | Open search dialog |
| Find Next | `Ctrl+G` or `F3` | `Cmd+G` | Find next occurrence |
| Find Previous | `Ctrl+Shift+G` or `Shift+F3` | `Cmd+Shift+G` | Find previous occurrence |
| Replace | `Ctrl+H` | `Cmd+Alt+F` | Open replace dialog |
| Select All Occurrences | `Ctrl+Shift+L` | `Cmd+Shift+L` | Select all matches |

## Code Formatting and Indentation

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Indent | `Tab` | `Tab` | Indent selected lines or insert tab |
| Outdent | `Shift+Tab` | `Shift+Tab` | Outdent selected lines |
| Auto Indent | `Ctrl+]` | `Cmd+]` | Auto-indent selection |
| Comment Toggle | `Ctrl+/` | `Cmd+/` | Toggle line/block comment |

## Code Folding

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Fold Code | `Ctrl+Shift+[` | `Cmd+Alt+[` | Fold code block at cursor |
| Unfold Code | `Ctrl+Shift+]` | `Cmd+Alt+]` | Unfold code block at cursor |
| Fold All | `Ctrl+K Ctrl+0` | `Cmd+K Cmd+0` | Fold all foldable blocks |
| Unfold All | `Ctrl+K Ctrl+J` | `Cmd+K Cmd+J` | Unfold all blocks |

## Selection

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Select Line | `Ctrl+L` | `Cmd+L` | Select entire line |
| Expand Selection | `Shift+Alt+Right` | `Shift+Alt+Right` | Expand selection to next token |
| Shrink Selection | `Shift+Alt+Left` | `Shift+Alt+Left` | Shrink selection to previous token |
| Multi-Cursor | `Alt+Click` | `Option+Click` | Add cursor at click position |
| Add Cursor Above | `Ctrl+Alt+Up` | `Cmd+Option+Up` | Add cursor on line above |
| Add Cursor Below | `Ctrl+Alt+Down` | `Cmd+Option+Down` | Add cursor on line below |

## Autocomplete

| Shortcut | Windows/Linux | macOS | Description |
|----------|---------------|-------|-------------|
| Trigger Autocomplete | `Ctrl+Space` | `Cmd+Space` | Show autocomplete suggestions |
| Accept Suggestion | `Enter` or `Tab` | `Enter` or `Tab` | Accept selected suggestion |
| Close Autocomplete | `Escape` | `Escape` | Close autocomplete panel |
| Navigate Suggestions | `Up/Down` | `Up/Down` | Navigate through suggestions |

## Bracket Matching

The editor automatically closes brackets, quotes, and other paired characters:

- Typing `(` automatically inserts `)`
- Typing `{` automatically inserts `}`
- Typing `[` automatically inserts `]`
- Typing `"` automatically inserts `"`
- Typing `'` automatically inserts `'`
- Typing `` ` `` automatically inserts `` ` ``

To override auto-closing, simply type the closing character again to skip over it.

## Language-Specific Features

The editor provides syntax highlighting and language-specific features for:

- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- Python (`.py`)
- Rust (`.rs`)
- Go (`.go`)
- C/C++ (`.c`, `.cpp`, `.h`, `.hpp`)
- Java (`.java`)
- HTML (`.html`, `.htm`)
- CSS/SCSS/LESS (`.css`, `.scss`, `.sass`, `.less`)
- JSON (`.json`)
- Markdown (`.md`, `.markdown`)
- XML (`.xml`)
- YAML (`.yaml`, `.yml`)
- SQL (`.sql`)
- PHP (`.php`)
- Shell scripts (`.sh`, `.bash`, `.zsh`)

## Additional Notes

### Browser Conflicts

Some keyboard shortcuts may conflict with browser shortcuts. The editor attempts to prevent default browser behavior for:

- `Ctrl+S` / `Cmd+S` - Prevents browser "Save Page" dialog
- `Ctrl+W` / `Cmd+W` - Prevents browser "Close Tab" action
- `Ctrl+F` / `Cmd+F` - Uses in-editor search instead of browser search

### Customization

The keyboard shortcuts are integrated with CodeMirror 6's keymap system. Custom keybindings are prioritized over default bindings, ensuring application-specific commands take precedence.

### Implementation Details

The editor uses the following CodeMirror 6 extensions for keyboard support:

- `defaultKeymap` - Basic text editing commands
- `historyKeymap` - Undo/redo functionality
- `searchKeymap` - Search and replace
- `foldKeymap` - Code folding
- `closeBracketsKeymap` - Auto-closing brackets
- `completionKeymap` - Autocomplete navigation
- Custom keybindings - Application-level commands (save, close, etc.)

### Cross-Platform Compatibility

All shortcuts use the `Mod` key notation internally, which automatically translates to:
- `Ctrl` on Windows and Linux
- `Cmd` on macOS

This ensures a native keyboard experience on each platform.

/**
 * File Tree Utilities Composable
 * Centralizes file tree logic to eliminate duplication
 * Inspired by VS Code/Zed editor architecture
 */

export interface FileIconInfo {
  type: string
  color: string
  category: 'code' | 'config' | 'markup' | 'style' | 'media' | 'data' | 'default'
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string | undefined | null): string {
  if (!filename || typeof filename !== 'string') {
    return ''
  }
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Get file type classification for styling
 */
export function getFileTypeClass(filename: string | undefined | null, isDirectory: boolean): string {
  if (isDirectory) {
    return 'icon-directory'
  }

  if (!filename || typeof filename !== 'string') {
    return 'icon-file'
  }

  const ext = getFileExtension(filename)

  // Comprehensive file type mapping
  const typeMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'icon-javascript',
    'jsx': 'icon-react',
    'ts': 'icon-typescript',
    'tsx': 'icon-react',
    'mjs': 'icon-javascript',
    'cjs': 'icon-javascript',

    // Vue
    'vue': 'icon-vue',

    // Styles
    'css': 'icon-css',
    'scss': 'icon-sass',
    'sass': 'icon-sass',
    'less': 'icon-less',

    // Data/Config
    'json': 'icon-json',
    'jsonc': 'icon-json',
    'json5': 'icon-json',
    'yaml': 'icon-yaml',
    'yml': 'icon-yaml',
    'toml': 'icon-config',
    'xml': 'icon-xml',
    'ini': 'icon-config',
    'cfg': 'icon-config',
    'conf': 'icon-config',
    'env': 'icon-config',

    // Documentation
    'md': 'icon-markdown',
    'markdown': 'icon-markdown',
    'txt': 'icon-text',
    'rst': 'icon-text',
    'doc': 'icon-text',
    'docx': 'icon-text',

    // Images
    'png': 'icon-image',
    'jpg': 'icon-image',
    'jpeg': 'icon-image',
    'gif': 'icon-image',
    'svg': 'icon-image',
    'webp': 'icon-image',
    'ico': 'icon-image',
    'bmp': 'icon-image',

    // Programming Languages
    'py': 'icon-python',
    'pyw': 'icon-python',
    'pyi': 'icon-python',
    'rs': 'icon-rust',
    'go': 'icon-go',
    'java': 'icon-java',
    'class': 'icon-java',
    'php': 'icon-php',
    'rb': 'icon-ruby',
    'c': 'icon-c',
    'cpp': 'icon-cpp',
    'h': 'icon-cpp',
    'hpp': 'icon-cpp',
    'cs': 'icon-csharp',
    'swift': 'icon-swift',
    'kt': 'icon-kotlin',

    // Shell/Scripts
    'sh': 'icon-shell',
    'bash': 'icon-shell',
    'zsh': 'icon-shell',
    'fish': 'icon-shell',
    'ps1': 'icon-shell',

    // Build/DevOps
    'dockerfile': 'icon-docker',
    'dockerignore': 'icon-docker',
    'gitignore': 'icon-git',
    'gitattributes': 'icon-git',

    // Special files
    'lock': 'icon-lock',
    'log': 'icon-text'
  }

  return typeMap[ext] || 'icon-file'
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Get file language for syntax highlighting
 */
export function getFileLanguage(filename: string | undefined | null): string {
  if (!filename || typeof filename !== 'string') {
    return 'plaintext'
  }
  const ext = getFileExtension(filename)

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Python
    'py': 'python',
    'pyw': 'python',
    'pyi': 'python',

    // Rust
    'rs': 'rust',

    // Go
    'go': 'go',

    // Java
    'java': 'java',
    'class': 'java',

    // C/C++
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',

    // C#
    'cs': 'csharp',

    // PHP
    'php': 'php',
    'phtml': 'php',

    // Ruby
    'rb': 'ruby',

    // Shell/Bash
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',

    // HTML/CSS
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',

    // JSON
    'json': 'json',
    'jsonc': 'json',
    'json5': 'json',

    // XML
    'xml': 'xml',
    'xhtml': 'xml',

    // YAML
    'yaml': 'yaml',
    'yml': 'yaml',

    // Markdown
    'md': 'markdown',
    'markdown': 'markdown',

    // SQL
    'sql': 'sql',

    // Docker
    'dockerfile': 'dockerfile',

    // Config
    'ini': 'ini',
    'toml': 'toml',
    'conf': 'ini',

    // Git
    'gitignore': 'ignore',

    // Vue
    'vue': 'vue',

    // Other
    'txt': 'plaintext',
    'log': 'plaintext'
  }

  return languageMap[ext] || 'plaintext'
}

/**
 * Check if a file is a text file (can be opened in editor)
 */
export function isTextFile(filename: string | undefined | null): boolean {
  if (!filename || typeof filename !== 'string') {
    return false
  }
  const textExtensions = [
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'pyw', 'pyi',
    'rs', 'go', 'java',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
    'cs', 'php', 'rb',
    'sh', 'bash', 'zsh', 'fish',
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'json', 'jsonc', 'json5',
    'xml', 'xhtml', 'yaml', 'yml',
    'md', 'markdown', 'sql',
    'dockerfile', 'ini', 'toml', 'conf',
    'gitignore', 'gitattributes',
    'vue', 'txt', 'log', 'env'
  ]

  const extension = getFileExtension(filename)
  return textExtensions.includes(extension)
}

/**
 * Check if a filename should be hidden by default
 */
export function isHiddenFile(filename: string | undefined | null): boolean {
  if (!filename || typeof filename !== 'string') {
    return false
  }
  return filename.startsWith('.') && filename !== '.'
}

/**
 * Sort files: directories first, then alphabetically
 */
export function sortFiles<T extends { name: string; type: 'file' | 'directory' }>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    // Directories first
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    // Then alphabetically (case-insensitive, natural sort)
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

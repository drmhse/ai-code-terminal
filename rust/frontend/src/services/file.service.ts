import { apiService } from './api'
import type { FileContent, DirectoryListing } from '@/types'

export class FileService {
  private static instance: FileService

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService()
    }
    return FileService.instance
  }

  async listDirectory(path: string = './'): Promise<DirectoryListing> {
    const response = await apiService.getDirectoryContents(path)
    // Convert from API FileItem[] to types FileItem[]
    const items: import('@/types').FileItem[] = response.map(item => ({
      name: item.name,
      path: item.path,
      is_directory: item.type === 'directory',
      size: item.size || 0,
      modified_at: item.modified || new Date().toISOString(),
      extension: item.extension || '',
      language: item.language || ''
    }))
    return {
      path,
      items,
      total_count: items.length
    }
  }

  async readFile(path: string): Promise<FileContent> {
    const content = await apiService.getFileContent(path)
    // Convert string to FileContent format
    return {
      path,
      content,
      encoding: 'utf-8',
      size: content.length
    }
  }

  async saveFile(path: string, content: string): Promise<void> {
    await apiService.saveFile(path, content)
  }

  async createFile(path: string, content: string = '', isDirectory: boolean = false): Promise<void> {
    if (isDirectory) {
      const parentPath = path.split('/').slice(0, -1).join('/') || '.'
      const name = path.split('/').pop() || ''
      await apiService.createDirectory(parentPath, name)
    } else {
      const parentPath = path.split('/').slice(0, -1).join('/') || '.'
      const name = path.split('/').pop() || ''
      await apiService.createFile(parentPath, name, content)
    }
  }

  async deleteFile(path: string): Promise<void> {
    await apiService.deleteFile(path)
  }

  async renameFile(fromPath: string, toPath: string): Promise<void> {
    await apiService.renameFile(fromPath, toPath)
  }

  getFileLanguage(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase()
    
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
      'xsd': 'xml',
      'xsl': 'xml',
      
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
      'dockerignore': 'ignore',
      
      // Configuration files
      'ini': 'ini',
      'toml': 'toml',
      'cfg': 'ini',
      'conf': 'ini',
      
      // Git
      'gitignore': 'ignore',
      'gitattributes': 'gitattributes',
      
      // TypeScript definitions
      'd.ts': 'typescript',
      
      // Vue
      'vue': 'vue',
      
      // React (already defined above)
      // 'jsx': 'javascript',
      // 'tsx': 'typescript',
      
      // Svelte
      'svelte': 'svelte',
      
      // Other
      'txt': 'plaintext',
      'log': 'plaintext',
      'csv': 'csv',
      'tsv': 'csv',
    }
    
    return languageMap[extension || ''] || 'plaintext'
  }

  isTextFile(filename: string): boolean {
    const textExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
      'py', 'pyw', 'pyi',
      'rs',
      'go',
      'java', 'class',
      'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
      'cs',
      'php', 'phtml',
      'rb',
      'sh', 'bash', 'zsh', 'fish',
      'html', 'htm', 'css', 'scss', 'sass', 'less',
      'json', 'jsonc', 'json5',
      'xml', 'xhtml', 'xsd', 'xsl',
      'yaml', 'yml',
      'md', 'markdown',
      'sql',
      'dockerfile', 'dockerignore',
      'ini', 'toml', 'cfg', 'conf',
      'gitignore', 'gitattributes',
      'd.ts',
      'vue',
      'txt', 'log',
      'csv', 'tsv'
    ]
    
    const extension = filename.split('.').pop()?.toLowerCase()
    return textExtensions.includes(extension || '')
  }

  isBinaryFile(filename: string): boolean {
    return !this.isTextFile(filename)
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }
}

export const fileService = FileService.getInstance()
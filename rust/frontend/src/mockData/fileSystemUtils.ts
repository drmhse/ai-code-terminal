import type { FileItem } from '@/stores/file'
import mockFileSystem from './fileSystem'

// File system node types (imported from fileSystem)
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  content?: string
  size?: number
  modified_at: string
  children?: Record<string, FileNode>
  extension?: string
  language?: string
  isHidden?: boolean
}

// Helper function to normalize file paths
const normalizePath = (path: string): string => {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
}

// Helper function to get file extension from name
const getFileExtension = (name: string): string | undefined => {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.substring(lastDot + 1) : undefined
}

// Helper function to detect language from extension
const detectLanguage = (extension: string | undefined): string | undefined => {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'vue': 'vue',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'dockerfile': 'docker',
    'gitignore': 'gitignore',
    'bashrc': 'shell',
    'zshrc': 'shell'
  }

  return extension ? languageMap[extension.toLowerCase()] : undefined
}

// Find a node in the file system by path
export const findNode = (path: string): FileNode | null => {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/') {
    return mockFileSystem['/']
  }

  const parts = normalizedPath.split('/').filter(part => part)
  let current: FileNode | Record<string, FileNode> = mockFileSystem

  for (const part of parts) {
    if (current && typeof current === 'object' && 'children' in current && current.children) {
      current = current.children[part]
    } else if (current && typeof current === 'object' && !('type' in current) && part in current) {
      current = current[part]
    } else {
      return null
    }
  }

  return current as FileNode || null
}

// Get children of a directory node as FileItem array
export const getChildren = (path: string): FileItem[] => {
  const node = findNode(path)

  if (!node || node.type !== 'directory' || !node.children) {
    return []
  }

  return Object.values(node.children).map(childNode => ({
    name: childNode.name,
    path: childNode.path,
    is_directory: childNode.type === 'directory',
    size: childNode.size || (childNode.type === 'directory' ? 0 : 1024),
    modified_at: childNode.modified_at,
    extension: childNode.extension || getFileExtension(childNode.name),
    language: childNode.language || detectLanguage(getFileExtension(childNode.name)),
    type: childNode.type,
    isHidden: childNode.isHidden || childNode.name.startsWith('.')
  }))
}

// Get content of a file
export const getFileContent = (path: string): string | null => {
  const node = findNode(path)

  if (!node || node.type !== 'file') {
    return null
  }

  return node.content || ''
}

// Create a new file or directory
export const createNode = (
  parentPath: string,
  name: string,
  type: 'file' | 'directory',
  content?: string
): boolean => {
  const parentNode = findNode(parentPath)

  if (!parentNode || parentNode.type !== 'directory' || !parentNode.children) {
    return false
  }

  const newPath = normalizePath(`${parentPath}/${name}`)
  const extension = getFileExtension(name)

  const newNode: FileNode = {
    name,
    path: newPath,
    type,
    modified_at: new Date().toISOString(),
    extension,
    language: type === 'file' ? detectLanguage(extension) : undefined,
    isHidden: name.startsWith('.')
  }

  if (type === 'file' && content) {
    newNode.content = content
    newNode.size = content.length
  } else if (type === 'file') {
    newNode.content = ''
    newNode.size = 0
  } else if (type === 'directory') {
    newNode.children = {}
    newNode.size = 0
  }

  parentNode.children[name] = newNode
  return true
}

// Update file content
export const updateFileContent = (path: string, content: string): boolean => {
  const node = findNode(path)

  if (!node || node.type !== 'file') {
    return false
  }

  node.content = content
  node.size = content.length
  node.modified_at = new Date().toISOString()

  return true
}

// Delete a file or directory
export const deleteNode = (path: string): boolean => {
  const normalizedPath = normalizePath(path)
  const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) || '/'
  const name = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1)

  const parentNode = findNode(parentPath)

  if (!parentNode || parentNode.type !== 'directory' || !parentNode.children) {
    return false
  }

  return delete parentNode.children[name]
}

// Rename a file or directory
export const renameNode = (oldPath: string, newName: string): boolean => {
  const normalizedOldPath = normalizePath(oldPath)
  const parentPath = normalizedOldPath.substring(0, normalizedOldPath.lastIndexOf('/')) || '/'
  const oldName = normalizedOldPath.substring(normalizedOldPath.lastIndexOf('/') + 1)

  const parentNode = findNode(parentPath)

  if (!parentNode || parentNode.type !== 'directory' || !parentNode.children) {
    return false
  }

  const node = parentNode.children[oldName]
  if (!node) {
    return false
  }

  // Remove old entry
  delete parentNode.children[oldName]

  // Update node properties
  node.name = newName
  node.path = normalizePath(`${parentPath}/${newName}`)
  node.modified_at = new Date().toISOString()

  // Update extension and language for files
  if (node.type === 'file') {
    node.extension = getFileExtension(newName)
    node.language = detectLanguage(node.extension)
  }

  // Add new entry
  parentNode.children[newName] = node

  return true
}

// Move a file or directory
export const moveNode = (fromPath: string, toPath: string): boolean => {
  const fromNode = findNode(fromPath)
  if (!fromNode) {
    return false
  }

  // Create new node at destination
  const toParentPath = toPath.substring(0, toPath.lastIndexOf('/')) || '/'
  const toName = toPath.substring(toPath.lastIndexOf('/') + 1)

  const success = createNode(
    toParentPath,
    toName,
    fromNode.type,
    fromNode.content
  )

  if (success) {
    // Copy children if it's a directory
    if (fromNode.type === 'directory' && fromNode.children) {
      const newNode = findNode(toPath)
      if (newNode && newNode.children) {
        Object.assign(newNode.children, fromNode.children)
      }
    }

    // Remove old node
    deleteNode(fromPath)
  }

  return success
}

// Copy a file or directory
export const copyNode = (fromPath: string, toPath: string): boolean => {
  const fromNode = findNode(fromPath)
  if (!fromNode) {
    return false
  }

  const toParentPath = toPath.substring(0, toPath.lastIndexOf('/')) || '/'
  const toName = toPath.substring(toPath.lastIndexOf('/') + 1)

  return createNode(
    toParentPath,
    toName,
    fromNode.type,
    fromNode.content
  )
}

// Check if a path exists
export const pathExists = (path: string): boolean => {
  return findNode(path) !== null
}

// Get directory structure for folder picker (simplified)
export const getDirectoryStructure = (maxDepth: number = 3): FileItem[] => {
  const result: FileItem[] = []

  const processNode = (node: FileNode, depth: number = 0): void => {
    if (depth >= maxDepth) {
      return
    }

    result.push({
      name: node.name,
      path: node.path,
      is_directory: node.type === 'directory',
      size: node.size || 0,
      modified_at: node.modified_at,
      type: node.type,
      isHidden: node.isHidden || false
    })

    if (node.type === 'directory' && node.children) {
      Object.values(node.children).forEach(child => {
        if (child.type === 'directory') {
          processNode(child, depth + 1)
        }
      })
    }
  }

  // Start from home directory
  const homeNode = findNode('/home/demo')
  if (homeNode) {
    processNode(homeNode)
  }

  return result
}

// Search for files by name or content
export const searchFiles = (
  query: string,
  searchInContent: boolean = false,
  maxResults: number = 50
): FileItem[] => {
  const results: FileItem[] = []
  const queryLower = query.toLowerCase()

  const searchNode = (node: FileNode): void => {
    if (results.length >= maxResults) {
      return
    }

    // Check name match
    if (node.name.toLowerCase().includes(queryLower)) {
      results.push({
        name: node.name,
        path: node.path,
        is_directory: node.type === 'directory',
        size: node.size || 0,
        modified_at: node.modified_at,
        extension: node.extension,
        language: node.language,
        type: node.type,
        isHidden: node.isHidden || false
      })
    }
    // Check content match for files
    else if (
      searchInContent &&
      node.type === 'file' &&
      node.content &&
      node.content.toLowerCase().includes(queryLower)
    ) {
      results.push({
        name: node.name,
        path: node.path,
        is_directory: false,
        size: node.size || 0,
        modified_at: node.modified_at,
        extension: node.extension,
        language: node.language,
        type: 'file',
        isHidden: node.isHidden || false
      })
    }

    // Recursively search children
    if (node.type === 'directory' && node.children) {
      Object.values(node.children).forEach(searchNode)
    }
  }

  // Start search from root
  const rootNode = mockFileSystem['/']
  if (rootNode) {
    searchNode(rootNode)
  }

  return results
}

// File system node types
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

// Mock file system structure representing a realistic project
export const mockFileSystem: Record<string, FileNode> = {
  '/': {
    name: '/',
    path: '/',
    type: 'directory',
    modified_at: '2024-01-20T10:00:00Z',
    children: {
      'home': {
        name: 'home',
        path: '/home',
        type: 'directory',
        modified_at: '2024-01-20T10:00:00Z',
        children: {
          'demo': {
            name: 'demo',
            path: '/home/demo',
            type: 'directory',
            modified_at: '2024-01-20T10:00:00Z',
            children: {
              'projects': {
                name: 'projects',
                path: '/home/demo/projects',
                type: 'directory',
                modified_at: '2024-01-20T10:00:00Z',
                children: {
                  'ai-terminal': createAiTerminalProject(),
                  'docs-site': createDocsSiteProject(),
                  'cli-tools': createCliToolsProject(),
                  'vue-components': createVueComponentsProject()
                }
              },
              'Documents': {
                name: 'Documents',
                path: '/home/demo/Documents',
                type: 'directory',
                modified_at: '2024-01-19T15:30:00Z',
                children: {
                  'notes.md': {
                    name: 'notes.md',
                    path: '/home/demo/Documents/notes.md',
                    type: 'file',
                    content: '# Project Notes\n\n## AI Terminal\n- Remember to update dependencies\n- Add more mock data examples\n\n## Ideas\n- Add file upload simulation\n- Implement drag & drop',
                    size: 2048,
                    extension: 'md',
                    language: 'markdown',
                    modified_at: '2024-01-19T15:30:00Z'
                  }
                }
              },
              '.bashrc': {
                name: '.bashrc',
                path: '/home/demo/.bashrc',
                type: 'file',
                content: '# Bash configuration\nexport PS1="\\u@\\w$ "\nexport EDITOR=vim\nalias ll="ls -la"',
                size: 256,
                extension: 'bashrc',
                language: 'shell',
                isHidden: true,
                modified_at: '2024-01-15T09:00:00Z'
              },
              '.zshrc': {
                name: '.zshrc',
                path: '/home/demo/.zshrc',
                type: 'file',
                content: '# Zsh configuration\nZSH_THEME="robbyrussell"\nplugins=(git npm docker)\nexport PATH="$HOME/.local/bin:$PATH"',
                size: 312,
                extension: 'zshrc',
                language: 'shell',
                isHidden: true,
                modified_at: '2024-01-18T14:20:00Z'
              }
            }
          }
        }
      },
      'usr': {
        name: 'usr',
        path: '/usr',
        type: 'directory',
        modified_at: '2024-01-01T00:00:00Z',
        children: {
          'bin': {
            name: 'bin',
            path: '/usr/bin',
            type: 'directory',
            modified_at: '2024-01-01T00:00:00Z',
            children: {}
          },
          'lib': {
            name: 'lib',
            path: '/usr/lib',
            type: 'directory',
            modified_at: '2024-01-01T00:00:00Z',
            children: {}
          }
        }
      },
      'tmp': {
        name: 'tmp',
        path: '/tmp',
        type: 'directory',
        modified_at: '2024-01-20T12:00:00Z',
        children: {}
      }
    }
  }
}

// Helper function to create AI Terminal project structure
function createAiTerminalProject(): FileNode {
  return {
    name: 'ai-terminal',
    path: '/home/demo/projects/ai-terminal',
    type: 'directory',
    modified_at: '2024-01-20T10:00:00Z',
    children: {
      'src': {
        name: 'src',
        path: '/home/demo/projects/ai-terminal/src',
        type: 'directory',
        modified_at: '2024-01-20T09:30:00Z',
        children: {
          'main.ts': {
            name: 'main.ts',
            path: '/home/demo/projects/ai-terminal/src/main.ts',
            type: 'file',
            content: 'import { createApp } from \'vue\'\nimport App from \'./App.vue\'\nimport router from \'./router\'\nimport { createPinia } from \'pinia\'\n\nconst app = createApp(App)\napp.use(router)\napp.use(createPinia())\napp.mount(\'#app\')',
            size: 3072,
            extension: 'ts',
            language: 'typescript',
            modified_at: '2024-01-20T09:30:00Z'
          },
          'App.vue': {
            name: 'App.vue',
            path: '/home/demo/projects/ai-terminal/src/App.vue',
            type: 'file',
            content: '<template>\n  <div id="app">\n    <router-view />\n  </div>\n</template>\n\n<script setup lang="ts">\n// App component\n</script>\n\n<style scoped>\n#app {\n  font-family: Avenir, Helvetica, Arial, sans-serif;\n}\n</style>',
            size: 4096,
            extension: 'vue',
            language: 'vue',
            modified_at: '2024-01-20T09:15:00Z'
          },
          'components': {
            name: 'components',
            path: '/home/demo/projects/ai-terminal/src/components',
            type: 'directory',
            modified_at: '2024-01-19T16:45:00Z',
            children: {
              'Header.vue': {
                name: 'Header.vue',
                path: '/home/demo/projects/ai-terminal/src/components/Header.vue',
                type: 'file',
                content: '<template>\n  <header class="app-header">\n    <h1>AI Terminal</h1>\n    <nav>\n      <router-link to="/">Home</router-link>\n      <router-link to="/workspace">Workspace</router-link>\n    </nav>\n  </header>\n</template>\n\n<script setup lang="ts">\n// Header component\n</script>',
                size: 2048,
                extension: 'vue',
                language: 'vue',
                modified_at: '2024-01-19T16:45:00Z'
              },
              'Terminal.vue': {
                name: 'Terminal.vue',
                path: '/home/demo/projects/ai-terminal/src/components/Terminal.vue',
                type: 'file',
                content: '<template>\n  <div class="terminal">\n    <div class="terminal-header">\n      <span>Terminal</span>\n    </div>\n    <div class="terminal-body" ref="terminalBody">\n      <div v-for="(line, index) in output" :key="index" class="terminal-line">\n        {{ line }}\n      </div>\n    </div>\n  </div>\n</template>\n\n<script setup lang="ts">\nimport { ref, onMounted } from \'vue\'\n\nconst output = ref<string[]>([])\nconst terminalBody = ref<HTMLElement>()\n\nonMounted(() => {\n  output.value.push(\'Welcome to AI Terminal\')\n  output.value.push(\'$ \')\n})\n</script>',
                size: 3072,
                extension: 'vue',
                language: 'vue',
                modified_at: '2024-01-20T08:20:00Z'
              }
            }
          },
          'services': {
            name: 'services',
            path: '/home/demo/projects/ai-terminal/src/services',
            type: 'directory',
            modified_at: '2024-01-20T10:00:00Z',
            children: {
              'api.ts': {
                name: 'api.ts',
                path: '/home/demo/projects/ai-terminal/src/services/api.ts',
                type: 'file',
                content: 'import axios from \'axios\'\n\nexport const api = {\n  getWorkspaces: async () => {\n    const response = await axios.get(\'/api/workspaces\')\n    return response.data\n  },\n  \n  createWorkspace: async (name: string, path: string) => {\n    const response = await axios.post(\'/api/workspaces\', { name, path })\n    return response.data\n  }\n}',
                size: 2560,
                extension: 'ts',
                language: 'typescript',
                modified_at: '2024-01-20T10:00:00Z'
              },
              'socket.ts': {
                name: 'socket.ts',
                path: '/home/demo/projects/ai-terminal/src/services/socket.ts',
                type: 'file',
                content: 'import { io } from \'socket.io-client\'\n\nexport const socket = io(\'ws://localhost:3001\')\n\nsocket.on(\'connect\', () => {\n  console.log(\'Connected to server\')\n})\n\nsocket.on(\'terminal:output\', (data) => {\n  console.log(\'Terminal output:\', data)\n})',
                size: 1792,
                extension: 'ts',
                language: 'typescript',
                modified_at: '2024-01-20T09:45:00Z'
              }
            }
          }
        }
      },
      'public': {
        name: 'public',
        path: '/home/demo/projects/ai-terminal/public',
        type: 'directory',
        modified_at: '2024-01-18T11:30:00Z',
        children: {
          'index.html': {
            name: 'index.html',
            path: '/home/demo/projects/ai-terminal/public/index.html',
            type: 'file',
            content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>AI Terminal</title>\n</head>\n<body>\n  <div id="app"></div>\n</body>\n</html>',
            size: 1024,
            extension: 'html',
            language: 'html',
            modified_at: '2024-01-18T11:30:00Z'
          }
        }
      },
      'package.json': {
        name: 'package.json',
        path: '/home/demo/projects/ai-terminal/package.json',
        type: 'file',
        content: JSON.stringify({
          name: 'ai-terminal',
          version: '1.0.0',
          description: 'AI-powered terminal interface',
          scripts: {
            dev: 'vite',
            build: 'vue-tsc && vite build',
            preview: 'vite preview'
          },
          dependencies: {
            vue: '^3.4.0',
            'vue-router': '^4.2.0',
            pinia: '^2.1.0',
            axios: '^1.6.0',
            'socket.io-client': '^4.7.0'
          },
          devDependencies: {
            vite: '^5.0.0',
            'vue-tsc': '^1.8.0',
            typescript: '^5.3.0'
          }
        }, null, 2),
        size: 1024,
        extension: 'json',
        language: 'json',
        modified_at: '2024-01-20T08:00:00Z'
      },
      'README.md': {
        name: 'README.md',
        path: '/home/demo/projects/ai-terminal/README.md',
        type: 'file',
        content: '# AI Terminal\n\nA revolutionary terminal interface with AI capabilities.\n\n## Features\n\n- Intelligent command completion\n- Natural language processing\n- Real-time collaboration\n- Multi-workspace support\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Usage\n\n1. Open the terminal interface\n2. Type commands naturally\n3. Let AI assist your workflow\n\n## Contributing\n\nPull requests are welcome!',
        size: 2048,
        extension: 'md',
        language: 'markdown',
        modified_at: '2024-01-19T14:20:00Z'
      },
      'tsconfig.json': {
        name: 'tsconfig.json',
        path: '/home/demo/projects/ai-terminal/tsconfig.json',
        type: 'file',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'preserve',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true
          },
          include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue'],
          references: [{ path: './tsconfig.node.json' }]
        }, null, 2),
        size: 1536,
        extension: 'json',
        language: 'json',
        modified_at: '2024-01-17T10:15:00Z'
      },
      '.gitignore': {
        name: '.gitignore',
        path: '/home/demo/projects/ai-terminal/.gitignore',
        type: 'file',
        content: '# Logs\nlogs\n*.log\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\n\n# Editor directories and files\n.vscode/*\n.idea\n*.swp\n*.swo\n\n# Build output\ndist\nnode_modules',
        size: 512,
        extension: 'gitignore',
        language: 'gitignore',
        isHidden: true,
        modified_at: '2024-01-15T13:45:00Z'
      }
    }
  }
}

// Helper function to create docs site project
function createDocsSiteProject(): FileNode {
  return {
    name: 'docs-site',
    path: '/home/demo/projects/docs-site',
    type: 'directory',
    modified_at: '2024-01-19T12:00:00Z',
    children: {
      'docs': {
        name: 'docs',
        path: '/home/demo/projects/docs-site/docs',
        type: 'directory',
        modified_at: '2024-01-19T11:30:00Z',
        children: {
          'getting-started.md': {
            name: 'getting-started.md',
            path: '/home/demo/projects/docs-site/docs/getting-started.md',
            type: 'file',
            content: '# Getting Started\n\nWelcome to the documentation site.\n\n## Installation\n\nFollow these steps to get started...',
            size: 1024,
            extension: 'md',
            language: 'markdown',
            modified_at: '2024-01-19T11:30:00Z'
          }
        }
      },
      'package.json': {
        name: 'package.json',
        path: '/home/demo/projects/docs-site/package.json',
        type: 'file',
        content: JSON.stringify({
          name: 'docs-site',
          version: '1.0.0',
          description: 'Documentation site',
          scripts: {
            dev: 'vitepress dev',
            build: 'vitepress build',
            preview: 'vitepress preview'
          },
          dependencies: {
            vitepress: '^1.0.0'
          }
        }, null, 2),
        size: 512,
        extension: 'json',
        language: 'json',
        modified_at: '2024-01-18T16:20:00Z'
      }
    }
  }
}

// Helper function to create CLI tools project
function createCliToolsProject(): FileNode {
  return {
    name: 'cli-tools',
    path: '/home/demo/projects/cli-tools',
    type: 'directory',
    modified_at: '2024-01-18T18:45:00Z',
    children: {
      'bin': {
        name: 'bin',
        path: '/home/demo/projects/cli-tools/bin',
        type: 'directory',
        modified_at: '2024-01-18T18:30:00Z',
        children: {
          'cli.js': {
            name: 'cli.js',
            path: '/home/demo/projects/cli-tools/bin/cli.js',
            type: 'file',
            content: '#!/usr/bin/env node\n\nconsole.log(\'Hello from CLI tools!\')\n\nprocess.argv.slice(2).forEach(arg => {\n  console.log(`Argument: ${arg}`)\n})',
            size: 1024,
            extension: 'js',
            language: 'javascript',
            modified_at: '2024-01-18T18:30:00Z'
          }
        }
      },
      'package.json': {
        name: 'package.json',
        path: '/home/demo/projects/cli-tools/package.json',
        type: 'file',
        content: JSON.stringify({
          name: 'cli-tools',
          version: '1.0.0',
          bin: {
            'my-cli': './bin/cli.js'
          }
        }, null, 2),
        size: 256,
        extension: 'json',
        language: 'json',
        modified_at: '2024-01-18T17:15:00Z'
      }
    }
  }
}

// Helper function to create Vue components project
function createVueComponentsProject(): FileNode {
  return {
    name: 'vue-components',
    path: '/home/demo/projects/vue-components',
    type: 'directory',
    modified_at: '2024-01-17T09:15:00Z',
    children: {
      'src': {
        name: 'src',
        path: '/home/demo/projects/vue-components/src',
        type: 'directory',
        modified_at: '2024-01-17T09:00:00Z',
        children: {
          'Button.vue': {
            name: 'Button.vue',
            path: '/home/demo/projects/vue-components/src/Button.vue',
            type: 'file',
            content: '<template>\n  <button :class="classes" @click="$emit(\'click\')">\n    <slot />\n  </button>\n</template>\n\n<script setup lang="ts">\ninterface Props {\n  variant?: \'primary\' | \'secondary\'\n  size?: \'sm\' | \'md\' | \'lg\'\n}\n\nwithDefaults(defineProps<Props>(), {\n  variant: \'primary\',\n  size: \'md\'\n})\n\ndefineEmits<{ click: [] }>()\n</script>',
            size: 1536,
            extension: 'vue',
            language: 'vue',
            modified_at: '2024-01-17T09:00:00Z'
          }
        }
      }
    }
  }
}

// Export the root file system
export default mockFileSystem
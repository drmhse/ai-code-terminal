import type { Repository } from '@/stores/workspace'

// Mock repositories data - static array for pagination and search simulation
export const mockRepositories: Repository[] = Array.from({ length: 127 }, (_, i) => ({
  id: i + 1,
  name: `mock-repo-${i + 1}`,
  full_name: `demo/mock-repo-${i + 1}`,
  description: `This is mock repository ${i + 1} for demonstration and testing purposes. It contains various example files and configurations.`,
  html_url: `https://github.com/demo/mock-repo-${i + 1}`,
  clone_url: `https://github.com/demo/mock-repo-${i + 1}.git`,
  ssh_url: `git@github.com:demo/mock-repo-${i + 1}.git`,
  private: i % 10 === 0, // Every 10th repo is private
  fork: i % 15 === 0,   // Every 15th repo is a fork
  archived: i % 20 === 0, // Every 20th repo is archived
  disabled: false,
  updated_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
  language: getRandomLanguage(i),
  stargazers_count: Math.floor(Math.random() * 5000) + 1,
  forks_count: Math.floor(Math.random() * 1000) + 1,
  size: Math.floor(Math.random() * 50000) + 100,
  default_branch: Math.random() > 0.3 ? 'main' : 'master',
  pushed_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
  owner: {
    id: 12345,
    login: 'demo',
    name: 'Demo User',
    email: 'demo@example.com',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    html_url: 'https://github.com/demo',
    company: 'Demo Organization',
    location: 'San Francisco, CA',
    public_repos: 127,
    followers: 250,
    following: 180
  }
}))

// Helper function to get random programming languages
function getRandomLanguage(index: number): string {
  const languages = [
    'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'Vue', 'React',
    'Angular', 'Svelte', 'Node.js', 'Django', 'FastAPI', 'Express', 'Flutter',
    'Swift', 'Kotlin', 'C#', 'C++', 'Ruby', 'PHP', 'Perl', 'R', 'MATLAB',
    'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Shell', 'PowerShell'
  ]
  return languages[index % languages.length]
}

// Search and pagination utilities
export const searchRepositories = (query: string, page: number = 1, pageSize: number = 10): {
  repositories: Repository[]
  hasMore: boolean
  totalCount: number
} => {
  const filtered = query
    ? mockRepositories.filter(repo =>
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        repo.description?.toLowerCase().includes(query.toLowerCase()) ||
        repo.language?.toLowerCase().includes(query.toLowerCase())
      )
    : mockRepositories

  const totalCount = filtered.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const repositories = filtered.slice(startIndex, endIndex)
  const hasMore = endIndex < totalCount

  return { repositories, hasMore, totalCount }
}

export const getRepositoryById = (id: number | string): Repository | undefined => {
  return mockRepositories.find(repo => repo.id.toString() === id.toString())
}

export const getRepositoryByName = (name: string): Repository | undefined => {
  return mockRepositories.find(repo => repo.name === name || repo.full_name === name)
}
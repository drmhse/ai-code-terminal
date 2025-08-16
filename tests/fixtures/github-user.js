export const mockGitHubUser = {
  id: 123456,
  login: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: 'https://github.com/test-user.png',
  html_url: 'https://github.com/test-user',
  type: 'User',
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockGitHubRepository = {
  id: 789012,
  name: 'test-repo',
  full_name: 'test-user/test-repo',
  private: false,
  html_url: 'https://github.com/test-user/test-repo',
  description: 'A test repository',
  language: 'JavaScript',
  default_branch: 'main',
  clone_url: 'https://github.com/test-user/test-repo.git',
  ssh_url: 'git@github.com:test-user/test-repo.git',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  owner: mockGitHubUser,
};

export const mockGitHubToken = 'gho_test_token_123456789';

export const mockOAuthResponse = {
  access_token: mockGitHubToken,
  token_type: 'bearer',
  scope: 'repo,user:email',
};
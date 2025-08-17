// Mock for @octokit/rest
const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: jest.fn().mockResolvedValue({ data: {} })
    },
    repos: {
      listForAuthenticatedUser: jest.fn().mockResolvedValue({ data: [] })
    }
  },
  auth: jest.fn()
};

module.exports = {
  Octokit: jest.fn(() => mockOctokit)
};
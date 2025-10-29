const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: jest.fn(),
      listEmailsForAuthenticatedUser: jest.fn(),
    },
    repos: {
      listForAuthenticatedUser: jest.fn(),
      get: jest.fn(),
    },
  },
};

const Octokit = jest.fn(() => mockOctokit);

module.exports = {
  Octokit,
  mockOctokit,
};

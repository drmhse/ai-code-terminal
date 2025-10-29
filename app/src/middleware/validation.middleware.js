// Simplified validation middleware for single-tenant system

function validateGitHubCallback(req, res, next) {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ 
      error: 'Invalid callback',
      message: 'Missing authorization code' 
    });
  }
  
  next();
}

function validateRepositoryQuery(req, res, next) {
  const { page, per_page } = req.query;
  
  if (page && (isNaN(page) || parseInt(page) < 1)) {
    return res.status(400).json({ error: 'Invalid page number' });
  }
  
  if (per_page && (isNaN(per_page) || parseInt(per_page) < 1 || parseInt(per_page) > 100)) {
    return res.status(400).json({ error: 'Invalid per_page value (1-100)' });
  }
  
  next();
}

function validateWorkspaceCreation(req, res, next) {
  const { githubRepo, githubUrl } = req.body;
  
  if (!githubRepo || !githubUrl) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      message: 'githubRepo and githubUrl are required' 
    });
  }
  
  if (typeof githubRepo !== 'string' || typeof githubUrl !== 'string') {
    return res.status(400).json({ error: 'githubRepo and githubUrl must be strings' });
  }
  
  // Validate repository format (owner/repo)
  if (!githubRepo.match(/^[\w\-\.]+\/[\w\-\.]+$/)) {
    return res.status(400).json({ 
      error: 'Invalid repository format',
      message: 'Repository must be in format: owner/repo' 
    });
  }
  
  // Basic URL validation
  try {
    new URL(githubUrl);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid GitHub URL format' });
  }
  
  next();
}

function validateWorkspaceId(req, res, next) {
  const { workspaceId } = req.params;
  
  if (!workspaceId || typeof workspaceId !== 'string') {
    return res.status(400).json({ error: 'Valid workspace ID required' });
  }
  
  next();
}

function validateJSON(req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  
  next();
}

module.exports = {
  validateGitHubCallback,
  validateRepositoryQuery,
  validateWorkspaceCreation,
  validateWorkspaceId,
  validateJSON
};
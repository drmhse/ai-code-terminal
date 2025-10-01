# Development Tools

This directory contains development and debugging utilities for the project.

## Scripts

### debug_ms_todo.py

**Purpose:** Debug Microsoft To Do integration by decrypting stored tokens and testing API connectivity.

**Requirements:**
```bash
pip install python-dotenv requests cryptography
```

**Usage:**
```bash
cd tools/
python debug_ms_todo.py
```

**What it does:**
1. Connects to the SQLite database (`rust/backend/data/act.db`)
2. Retrieves encrypted Microsoft access tokens
3. Decrypts tokens using the `MS_ENCRYPTION_KEY` from `rust/backend/.env`
4. Makes a test API call to Microsoft Graph API
5. Displays the results and diagnoses common issues

**When to use:**
- Debugging authentication issues with Microsoft To Do
- Verifying token encryption/decryption is working correctly
- Testing if Microsoft Graph API is accessible
- Diagnosing why task lists are not appearing

**Output:**
The script provides color-coded output showing:
- Database connection status
- Token decryption results
- API response data
- Diagnostic conclusions about what might be wrong
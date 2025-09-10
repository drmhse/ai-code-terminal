# ACT VFS - Virtual File System Adapter

The `act-vfs` crate provides a sandboxed file system implementation that acts as an adapter between the domain layer and the actual operating system file system. This crate implements the `FileSystem` trait from `act-core` with security and path validation.

## Architecture

This crate is an **adapter** in our hexagonal architecture:
- **Domain Interface Implementation**: Implements `FileSystem` trait from `act-core`
- **Security Layer**: Provides path validation and sandboxing
- **OS Abstraction**: Wraps standard library file operations with domain types
- **Error Translation**: Converts OS errors to domain `CoreError` types

## Core Component: SandboxedFileSystem

The main export is `SandboxedFileSystem`, which provides secure file operations within a designated workspace root.

### Basic Usage

```rust
use act_vfs::SandboxedFileSystem;
use act_core::{FileSystem, CreateFileRequest};
use std::path::PathBuf;

// Create a sandboxed file system rooted at /workspaces
let fs = SandboxedFileSystem::new(PathBuf::from("/workspaces"));

// All operations are confined within the workspace root
let listing = fs.list_directory(&PathBuf::from("project1")).await?;

// This resolves to /workspaces/project1/src/main.rs
let content = fs.read_file(&PathBuf::from("project1/src/main.rs")).await?;
println!("File content: {}", content.content);
```

### Security Features

The sandboxed file system provides several security guarantees:

```rust
use act_vfs::SandboxedFileSystem;
use std::path::PathBuf;

let fs = SandboxedFileSystem::new(PathBuf::from("/workspaces"));

// ✅ Allowed: Within workspace
fs.read_file(&PathBuf::from("project/file.txt")).await?;

// ❌ Blocked: Path traversal attempts
// These will return CoreError::PermissionDenied
fs.read_file(&PathBuf::from("../etc/passwd")).await?;           // Blocked
fs.read_file(&PathBuf::from("/etc/passwd")).await?;             // Blocked  
fs.read_file(&PathBuf::from("project/../../secret")).await?;    // Blocked

// ❌ Blocked: Symlinks outside workspace
fs.read_file(&PathBuf::from("symlink_to_root")).await?;         // Blocked
```

### Path Validation

All paths are validated and normalized before use:

```rust
// Input paths are normalized
assert!(fs.is_path_allowed(&PathBuf::from("./project/../project/file.txt")));
assert!(!fs.is_path_allowed(&PathBuf::from("../outside_workspace")));
assert!(!fs.is_path_allowed(&PathBuf::from("/absolute/path")));

// Workspace root is accessible
let root = fs.get_workspace_root();
println!("Workspace root: {}", root.display());
```

## File Operations

### Directory Operations

```rust
use act_core::{CreateDirectoryRequest, DirectoryListing};

// List directory contents
let listing: DirectoryListing = fs.list_directory(&PathBuf::from("project")).await?;
println!("Found {} items in project/", listing.items.len());

for item in listing.items {
    println!("{} {} ({})", 
             if item.is_directory { "DIR " } else { "FILE" },
             item.name,
             item.size.map_or("N/A".to_string(), |s| s.to_string()));
}

// Create directory
fs.create_directory(&CreateDirectoryRequest {
    path: "new_project/src".to_string(),
}).await?;

// Check if path is directory
let is_dir = fs.is_directory(&PathBuf::from("project")).await?;
let is_file = fs.is_file(&PathBuf::from("project/README.md")).await?;

// Delete directory (with optional recursion)
fs.delete_directory(&PathBuf::from("old_project"), true).await?; // recursive
```

### File Operations

```rust
use act_core::{CreateFileRequest, FileContent, MoveRequest, CopyRequest};

// Read file content
let content: FileContent = fs.read_file(&PathBuf::from("project/README.md")).await?;
println!("Content: {}", content.content);
println!("Size: {} bytes", content.size);
println!("MIME type: {:?}", content.mime_type);

// Write/create file
fs.write_file(CreateFileRequest {
    path: "project/new_file.txt".to_string(),
    content: "Hello, world!".to_string(),
    overwrite: true,
}).await?;

// Check if file exists
let exists = fs.exists(&PathBuf::from("project/file.txt")).await?;

// Get file metadata
let file_info = fs.get_file_info(&PathBuf::from("project/file.txt")).await?;
println!("Modified: {:?}", file_info.modified_at);
println!("Permissions: {:?}", file_info.permissions);

// Move/rename file
fs.move_item(&MoveRequest {
    from_path: "project/old_name.txt".to_string(),
    to_path: "project/new_name.txt".to_string(),
}).await?;

// Copy file
fs.copy_item(&CopyRequest {
    from_path: "project/source.txt".to_string(),
    to_path: "project/backup.txt".to_string(),
    recursive: false, // Only for directories
}).await?;

// Delete file
fs.delete_file(&PathBuf::from("project/temp.txt")).await?;
```

## Domain Integration

The VFS integrates seamlessly with domain services:

```rust
use act_domain::WorkspaceService;
use act_vfs::SandboxedFileSystem;
use std::sync::Arc;

// Inject into domain service
let filesystem: Arc<dyn FileSystem> = Arc::new(
    SandboxedFileSystem::new(PathBuf::from("/workspaces"))
);

let workspace_service = WorkspaceService::new(
    workspace_repo,
    filesystem, // <- VFS adapter injected here
    git_service,
    "/workspaces".to_string(),
);

// Domain service uses VFS through trait
let workspace = workspace_service.create_workspace(
    "My Project".to_string(),
    None,
    None
).await?;
```

## Error Handling

All file system errors are converted to domain errors:

```rust
use act_core::CoreError;

match fs.read_file(&PathBuf::from("nonexistent.txt")).await {
    Ok(content) => println!("Content: {}", content.content),
    Err(CoreError::NotFound(msg)) => println!("File not found: {}", msg),
    Err(CoreError::PermissionDenied(msg)) => println!("Access denied: {}", msg),
    Err(CoreError::FileSystem(msg)) => println!("File system error: {}", msg),
    Err(e) => println!("Other error: {}", e),
}
```

**Common Error Mappings:**
- `std::io::ErrorKind::NotFound` → `CoreError::NotFound`
- `std::io::ErrorKind::PermissionDenied` → `CoreError::PermissionDenied` 
- Path traversal attempts → `CoreError::PermissionDenied`
- Invalid paths → `CoreError::Validation`
- Other I/O errors → `CoreError::FileSystem`

## Advanced Features

### Workspace Root Management

```rust
let fs = SandboxedFileSystem::new(PathBuf::from("/workspaces"));

// Get the root directory
let root = fs.get_workspace_root();
println!("Operating within: {}", root.display());

// Check path validation
assert!(fs.is_path_allowed(&PathBuf::from("project/file.txt")));
assert!(!fs.is_path_allowed(&PathBuf::from("../outside")));
```

### File Type Detection

The VFS automatically detects file types and provides metadata:

```rust
let file_info = fs.get_file_info(&PathBuf::from("project/image.png")).await?;

// Rich metadata
println!("Name: {}", file_info.name);
println!("Is directory: {}", file_info.is_directory);
println!("Size: {:?}", file_info.size);
println!("Created: {:?}", file_info.created_at);
println!("Modified: {:?}", file_info.modified_at);

if let Some(permissions) = file_info.permissions {
    println!("Readable: {}", permissions.readable);
    println!("Writable: {}", permissions.writable);  
    println!("Executable: {}", permissions.executable);
}
```

### Batch Operations

While individual operations are atomic, you can compose them for batch operations:

```rust
async fn setup_project_structure(fs: &SandboxedFileSystem, project_name: &str) -> Result<()> {
    let base = format!("{}/", project_name);
    
    // Create directory structure
    fs.create_directory(&CreateDirectoryRequest {
        path: format!("{}src", base),
    }).await?;
    
    fs.create_directory(&CreateDirectoryRequest {
        path: format!("{}tests", base),
    }).await?;
    
    // Create initial files
    fs.write_file(CreateFileRequest {
        path: format!("{}README.md", base),
        content: format!("# {}\n\nProject description here.", project_name),
        overwrite: false,
    }).await?;
    
    fs.write_file(CreateFileRequest {
        path: format!("{}src/main.rs", base), 
        content: "fn main() {\n    println!(\"Hello, world!\");\n}".to_string(),
        overwrite: false,
    }).await?;
    
    Ok(())
}
```

## Testing

The VFS is designed to be easily testable:

```rust
use tempfile::TempDir;

#[tokio::test]
async fn test_sandboxed_operations() -> Result<()> {
    // Use temporary directory for testing
    let temp_dir = TempDir::new()?;
    let fs = SandboxedFileSystem::new(temp_dir.path().to_path_buf());
    
    // Test file creation
    fs.write_file(CreateFileRequest {
        path: "test.txt".to_string(),
        content: "test content".to_string(),
        overwrite: false,
    }).await?;
    
    // Test file reading
    let content = fs.read_file(&PathBuf::from("test.txt")).await?;
    assert_eq!(content.content, "test content");
    
    // Test path validation
    let result = fs.read_file(&PathBuf::from("../outside.txt")).await;
    assert!(matches!(result, Err(CoreError::PermissionDenied(_))));
    
    Ok(())
}
```

## Performance Considerations

- **Caching**: File metadata is not cached by default - consider adding a caching layer if needed
- **Async I/O**: All operations use tokio's async file I/O for non-blocking execution
- **Path Validation**: Path checks are performed on every operation for security
- **Memory Usage**: Large files are read into memory - consider streaming for very large files

## Security Model

The VFS implements a strict security model:

1. **Workspace Containment**: All operations are confined to the workspace root
2. **Path Validation**: Every path is validated before access
3. **Symlink Protection**: Symlinks pointing outside workspace are blocked
4. **No Privilege Escalation**: Operations run with the same privileges as the process
5. **Error Information**: Errors don't leak information about paths outside workspace

This makes it safe to use in multi-tenant environments where different users should not access each other's workspaces.
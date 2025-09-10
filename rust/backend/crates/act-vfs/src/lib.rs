pub mod filesystem;
pub mod types;

pub use filesystem::SandboxedFileSystem;
// Types are re-exported through core

// Re-export core types for convenience
pub use act_core::{
    FileSystem, FileItem, FilePermissions, DirectoryListing, FileContent,
    CreateFileRequest, CreateDirectoryRequest, MoveRequest, CopyRequest,
    Result
};
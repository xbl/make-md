use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub children: Vec<TreeNode>,
}

fn should_skip_dir(name: &str) -> bool {
    name == ".git" || name == "node_modules" || name.starts_with('.')
}

pub fn build_markdown_tree(root: &str) -> Result<TreeNode, String> {
    let root_path = PathBuf::from(root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }
    build_folder_node(&root_path)
}

fn build_folder_node(path: &Path) -> Result<TreeNode, String> {
    let mut children = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(path)
        .map_err(|err| err.to_string())?
        .filter_map(|entry| entry.ok())
        .collect();
    entries.sort_by_key(|entry| entry.file_name());

    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if should_skip_dir(&name) {
                continue;
            }
            children.push(build_folder_node(&entry_path)?);
        } else if name.ends_with(".md") || name.ends_with(".markdown") {
            children.push(TreeNode {
                name,
                path: entry_path.to_string_lossy().to_string(),
                kind: "file".to_string(),
                children: vec![],
            });
        }
    }

    Ok(TreeNode {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: path.to_string_lossy().to_string(),
        kind: "folder".to_string(),
        children,
    })
}

#[tauri::command]
pub fn list_markdown_tree(root: String) -> Result<TreeNode, String> {
    build_markdown_tree(&root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn lists_markdown_files_recursively() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("notes")).unwrap();
        fs::write(root.join("readme.md"), "# Hi").unwrap();
        fs::write(root.join("notes/a.md"), "# A").unwrap();
        fs::write(root.join("notes/skip.txt"), "nope").unwrap();

        let tree = build_markdown_tree(root.to_str().unwrap()).unwrap();
        assert_eq!(tree.kind, "folder");
        assert!(tree.children.iter().any(|node| node.name == "readme.md"));
        let notes = tree.children.iter().find(|node| node.name == "notes").unwrap();
        assert!(notes.children.iter().any(|node| node.name == "a.md"));
    }

    #[test]
    fn skips_git_and_node_modules() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join(".git/hidden.md"), "# X").unwrap();
        fs::write(root.join("node_modules/pkg/x.md"), "# X").unwrap();
        fs::write(root.join("ok.md"), "# Ok").unwrap();

        let tree = build_markdown_tree(root.to_str().unwrap()).unwrap();
        let names: Vec<_> = tree.children.iter().map(|node| node.name.as_str()).collect();
        assert!(names.contains(&"ok.md"));
        assert!(!names.iter().any(|name| *name == ".git" || *name == "node_modules"));
    }
}

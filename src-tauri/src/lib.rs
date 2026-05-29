fn projects_root() -> Result<std::path::PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let root = if cwd.file_name().and_then(|n| n.to_str()) == Some("src-tauri") {
        cwd.parent().unwrap_or(&cwd).to_path_buf()
    } else {
        cwd
    };
    Ok(root.join("data").join("projects"))
}

#[derive(serde::Serialize)]
struct FileNode {
    name: String,
    is_dir: bool,
    children: Vec<FileNode>,
}

fn read_dir_tree(dir: &std::path::Path, depth: usize) -> Result<Vec<FileNode>, String> {
    if depth > 10 {
        return Ok(vec![]);
    }
    let mut entries: Vec<FileNode> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            let is_dir = e.file_type().ok()?.is_dir();
            let children = if is_dir {
                read_dir_tree(&e.path(), depth + 1).unwrap_or_default()
            } else {
                vec![]
            };
            Some(FileNode { name, is_dir, children })
        })
        .collect();
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}

#[tauri::command]
fn list_project_files(name: String) -> Result<Vec<FileNode>, String> {
    let path = projects_root()?.join(name.trim());
    if !path.exists() {
        return Ok(vec![]);
    }
    read_dir_tree(&path, 0)
}

#[tauri::command]
fn list_projects() -> Result<Vec<String>, String> {
    let dir = projects_root()?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            if entry.file_type().ok()?.is_dir() {
                entry.file_name().into_string().ok()
            } else {
                None
            }
        })
        .collect();
    names.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(names)
}

#[tauri::command]
fn create_project(name: String) -> Result<(), String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if clean.contains('/') || clean.contains('\\') || clean.contains("..") {
        return Err("Project name contains invalid characters".to_string());
    }
    let project_path = projects_root()?.join(clean);
    if project_path.exists() {
        return Err(format!("A project named '{}' already exists", clean));
    }
    std::fs::create_dir_all(&project_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            list_project_files,
            create_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

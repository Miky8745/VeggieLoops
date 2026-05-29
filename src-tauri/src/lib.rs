#[tauri::command]
fn create_project(name: String) -> Result<(), String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if clean.contains('/') || clean.contains('\\') || clean.contains("..") {
        return Err("Project name contains invalid characters".to_string());
    }

    let base = std::env::current_dir().map_err(|e| e.to_string())?;
    let project_path = base.join("data").join("projects").join(clean);

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
        .invoke_handler(tauri::generate_handler![create_project])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

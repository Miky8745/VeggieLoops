use quick_xml::se::Serializer;
use serde::{Deserialize, Serialize};

use crate::projects_root;

fn validate_project_name(name: &str) -> Result<&str, String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if clean.contains('/') || clean.contains('\\') || clean.contains("..") {
        return Err("Project name contains invalid characters".to_string());
    }
    Ok(clean)
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChannelSettings {
    pub id: u32,
    pub sample_path: Option<String>,
    #[serde(default)]
    pub sample_folder: Option<String>,
    pub muted: bool,
    pub pan: f64,
    pub volume: f64,
    pub mixer_track: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteData {
    pub id: u32,
    pub pitch: i32,
    pub start: u32,
    pub length: u32,
    pub velocity: f64,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PatternContentEntry {
    pub pattern_id: u32,
    pub channel_id: u32,
    #[serde(default)]
    pub steps: Vec<bool>,
    #[serde(default)]
    pub notes: Vec<NoteData>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatternDataXml {
    pub id: u32,
    pub name: String,
    pub color: String,
    pub length_beats: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlacementXml {
    pub id: u32,
    pub pattern_id: u32,
    pub track_id: u32,
    pub start_beat: f64,
}

// quick-xml repeats a bare Vec<T> field's own tag name per element rather
// than emitting one tag per item, so each list gets a wrapper struct with a
// renamed inner field to produce clean per-item tags (<channel>, <entry>, …).
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ChannelsXml {
    #[serde(rename = "channel", default)]
    pub items: Vec<ChannelSettings>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ContentXml {
    #[serde(rename = "entry", default)]
    pub items: Vec<PatternContentEntry>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct PatternsXml {
    #[serde(rename = "pattern", default)]
    pub items: Vec<PatternDataXml>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct PlacementsXml {
    #[serde(rename = "placement", default)]
    pub items: Vec<PlacementXml>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub beats_per_bar: u32,
    pub pattern_length: u32,
    pub tempo: f64,
    pub selected_pattern_id: u32,
    pub channels: ChannelsXml,
    pub content: ContentXml,
    pub patterns: PatternsXml,
    pub placements: PlacementsXml,
}

#[tauri::command]
pub fn save_project(name: String, project: ProjectFile) -> Result<(), String> {
    let clean = validate_project_name(&name)?;
    let path = projects_root()?.join(clean).join(format!("{}.vlp", clean));
    let mut body = String::new();
    let mut ser = Serializer::new(&mut body);
    ser.indent(' ', 2);
    project.serialize(ser).map_err(|e| e.to_string())?;
    let xml = format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n{}\n", body);
    std::fs::write(&path, xml).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_project(name: String) -> Result<Option<ProjectFile>, String> {
    let clean = validate_project_name(&name)?;
    let path = projects_root()?.join(clean).join(format!("{}.vlp", clean));
    if !path.exists() {
        return Ok(None);
    }
    let xml = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    quick_xml::de::from_str(&xml).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_history(name: String, contents: String) -> Result<(), String> {
    let clean = validate_project_name(&name)?;
    let path = projects_root()?.join(clean).join("history");
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_history(name: String) -> Result<Option<String>, String> {
    let clean = validate_project_name(&name)?;
    let path = projects_root()?.join(clean).join("history");
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

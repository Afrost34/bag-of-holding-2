//! Desktop shell. The whole app is the web build; this crate only adds native capabilities
//! (real folders on disk now; popup windows and the updater in later milestones).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Bag of Holding");
}

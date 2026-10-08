//! Desktop shell. The whole app is the web build; this crate only adds native capabilities:
//! real folders on disk, the player window (`window.open` from a board), links to other sites in
//! the system browser, and updates from GitHub Releases.

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

/// Pages of the app itself (in a build or in `tauri dev`), as opposed to other sites.
fn is_app_url(url: &Url) -> bool {
    url.scheme() == "tauri"
        || matches!(url.host_str(), Some("tauri.localhost") | Some("localhost") | Some("127.0.0.1"))
}

/// Looks for a newer release; when there is one, asks before installing it and restarting.
async fn check_for_update(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(());
    };
    let version = update.version.clone();
    let restart = app.clone();
    app.dialog()
        .message(format!(
            "Bag of Holding {version} is ready. Install it now? The app restarts when it is done."
        ))
        .title("Update")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Install and restart".into(),
            "Later".into(),
        ))
        .show(move |yes| {
            if !yes {
                return;
            }
            tauri::async_runtime::spawn(async move {
                match update.download_and_install(|_, _| {}, || {}).await {
                    Ok(()) => restart.restart(),
                    Err(error) => eprintln!("Update failed: {error}"),
                }
            });
        });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Bag of Holding")
                .inner_size(1440.0, 900.0)
                .min_inner_size(400.0, 500.0)
                .center()
                // The app's own pages (the player window) open as app windows; other sites in
                // the browser.
                .on_new_window(move |url, _features| {
                    if is_app_url(&url) {
                        NewWindowResponse::Allow
                    } else {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        NewWindowResponse::Deny
                    }
                })
                .build()?;
            let app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = check_for_update(app).await {
                    eprintln!("Update check failed: {error}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bag of Holding");
}

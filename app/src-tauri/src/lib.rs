mod subscription_manager;
mod opentelemetry;
mod domain;
mod web_server;
mod websocket_hub;
mod app_state;

use std::sync::{Arc};
use tauri::{Emitter, Manager};
use tokio::sync::{RwLock};
use crate::app_state::AppState;
use crate::subscription_manager::{SubscriptionManager};
use crate::web_server::init_axum;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_state = AppState {
                subscription_manager: Arc::new(RwLock::new(SubscriptionManager::new()))
            };
            app.manage(app_state.clone());
            #[cfg(desktop)]
            {
                app.emit("agent-started", ()).unwrap();

                tauri::async_runtime::spawn(async move {
                    init_axum(app_state).await.expect("failed to start axum server");
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}




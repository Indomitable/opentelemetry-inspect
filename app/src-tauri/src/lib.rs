mod subscription_manager;
mod opentelemetry;
mod domain;
mod web_server;
mod websocket_hub;
mod app_state;
mod grpc_server;
mod request_processor;
mod server;

use std::sync::{Arc};
#[cfg(feature = "tauri")]
use tauri::{Emitter, Manager};
use tokio::sync::{RwLock};
use crate::app_state::AppState;
use crate::grpc_server::init_grpc;
use crate::request_processor::RequestProcessor;
use crate::subscription_manager::{SubscriptionManager};
use crate::web_server::init_axum;

pub async fn axum_main() -> Result<(), &'static str> {
    println!("Starting axum server");
    let app_state = create_state();
    tokio::select! {
        res0 = init_axum(app_state.clone()) => {
            res0.or(Err("failed to start axum server"))
        },
        res1 = init_grpc(app_state) => {
            res1.or(Err("failed to start grpc server"))
        }
    }
}

#[cfg(feature = "tauri")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn tauri_main() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .setup(|app| {
            let app_state = create_state();
            app.manage(app_state.clone());
            #[cfg(desktop)]
            {
                app.emit("agent-started", ()).unwrap();

                let web_app_state = app_state.clone();
                tauri::async_runtime::spawn(async move {
                    init_axum(web_app_state).await.expect("failed to start axum server");
                });

                tauri::async_runtime::spawn(async move {
                    init_grpc(app_state).await.expect("failed to start grpc server");
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn create_state() -> AppState {
    let subscription_manager = Arc::new(RwLock::new(SubscriptionManager::new()));
    let request_processor = Arc::new(RequestProcessor::new(subscription_manager.clone()));
    AppState {
        subscription_manager,
        request_processor,
    }
}

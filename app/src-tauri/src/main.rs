// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "docker")]
#[tokio::main]
async fn main() {
    opentelemetry_inspect_lib::axum_main().await.unwrap()
}

#[cfg(feature = "tauri")]
fn main() {
    opentelemetry_inspect_lib::tauri_main()
}

use std::sync::Arc;
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::extract::ws::{Message, Utf8Bytes, WebSocket};
use axum::http::{StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize};
use tauri::{Emitter, Manager};
use tauri::ipc::Channel;
use tokio::sync::broadcast;
use futures::{SinkExt, StreamExt};

#[derive(Clone)]
struct TauriState {
    events: broadcast::Sender<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let (tx, _rx) = broadcast::channel::<String>(100);
            let tauri_state = TauriState { events: tx.clone() };
            let state = Arc::new(tauri_state);
            app.manage(state.clone());
            #[cfg(desktop)]
            {
                app.emit("agent-started", ()).unwrap();

                tauri::async_runtime::spawn(async move {
                    init_axum(state).await.expect("failed to start axum server");
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![connect_to_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// #[derive(Clone, Serialize)]
// struct LogEvent<'message_life> {
//     message: &'message_life str,
// }

async fn init_axum(state: Arc<TauriState> /*app: AppHandle*/) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:5237").await?;
    let app = Router::new()
        .route("/", post(post_handle))
        .route("/ws", get(websocket_handler))
        .with_state(state);
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Deserialize)]
struct MessageQuery {
    message: String,
}

async fn post_handle(State(state): State<Arc<TauriState>>, query: Query<MessageQuery>) -> impl IntoResponse {
    state.events.send(query.message.clone()).unwrap();
    (StatusCode::ACCEPTED, "Accepted").into_response()
}

async fn websocket_handler(ws: WebSocketUpgrade, State(state): State<Arc<TauriState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

async fn handle_websocket(socket: WebSocket, state: Arc<TauriState>) {
    let (mut sender, mut _receiver) = socket.split();

    let mut rx = state.events.subscribe();
    while let Ok(message) = rx.recv().await {
        let msg = Utf8Bytes::from(message);
        sender.send(Message::Text(msg)).await.unwrap();
    }
}

#[tauri::command]
async fn connect_to_events(_topic: String, on_event: Channel<String>, state: tauri::State<'_, Arc<TauriState>>) -> Result<(), ()> {
    let mut rx = state.events.subscribe();
    while let Ok(message) = rx.recv().await {
        let res = on_event.send(message);
        if res.is_err() {
            println!("Unable to send event.");
        }
    }
    Ok(())
}
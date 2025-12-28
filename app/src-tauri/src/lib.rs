mod subscription_manager;
mod opentelemetry;
mod log_dto;

use std::collections::{HashMap};
use std::sync::{Arc};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::extract::ws::{Message, Utf8Bytes, WebSocket};
use axum::http::{StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use futures::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use uuid::{Uuid};
use tokio::sync::{RwLock};
use crate::subscription_manager::{Message as Msg, SubscriptionManager, Topic};
use crate::opentelemetry::proto::collector::logs::v1::{ExportLogsServiceRequest, ExportLogsServiceResponse};
use crate::log_dto::LogDto;

#[derive(Clone)]
struct AppState {
    subscription_manager: Arc<RwLock<SubscriptionManager>>
}

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

fn get_otlp_routes() -> Router<AppState> {
    let otlp_routes = Router::new()
        .route("/logs", post(handle_logs));
    otlp_routes
}

async fn init_axum(state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4318").await?;
    let app = Router::new()
        .route("/", post(post_handle))
        .route("/ws", get(websocket_handler))
        .nest("/v1", get_otlp_routes())
        .with_state(state);
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Deserialize)]
struct MessageQuery {
    topic: String,
    message: String,
}

async fn post_handle(State(state): State<AppState>, query: Query<MessageQuery>) -> impl IntoResponse {
    let event = Msg::new(&query.topic, &query.message);
    let res = state.subscription_manager.read().await.publish(event);
    match res {
        Ok(clients) => (StatusCode::ACCEPTED, format!("Clients: {}", clients)).into_response(),
        Err(_) =>  (StatusCode::BAD_REQUEST, "Unable to dispatch the message.").into_response(),
    }
}

// Resources:
// Proto: https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/collector/logs/v1/logs_service.proto
// Collector-Go: https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/otlphttp.go
// Aspire-Dashboard-C#: https://github.com/dotnet/aspire/blob/main/src/Aspire.Dashboard/Otlp/Http/OtlpHttpEndpointsBuilder.cs
async fn handle_logs(State(state): State<AppState>, request: axum::extract::Request) -> impl IntoResponse {
    let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
        Ok(bytes) => bytes,
        Err(_) => return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response(),
    };
    let request = ExportLogsServiceRequest::decode(body).unwrap();
    //println!("Received request: {:?}", request);

    for resource_log in request.resource_logs {
        let resource = resource_log.resource.as_ref();
        for scope_log in resource_log.scope_logs {
            let scope = scope_log.scope.as_ref();
            for log_record in scope_log.log_records {
                let dto = LogDto::from_otlp(log_record, scope, resource);
                let payload = serde_json::to_string(&dto).unwrap();
                let event = Msg::new("logs", &payload);
                let _ = state.subscription_manager.read().await.publish(event);
            }
        }
    }

    let mut bytes = Vec::new();
    let export_logs_response = ExportLogsServiceResponse::default();
    ExportLogsServiceResponse::encode(&export_logs_response, &mut bytes).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/x-protobuf")
        .body(bytes.into())
        .unwrap()
}

async fn websocket_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

#[derive(Deserialize)]
enum Command {
    Subscribe(Topic),
    Unsubscribe(Topic),
}

#[derive(Deserialize)]
struct WebSocketCommand {
    command: Command
}

#[derive(Serialize)]
struct ConnectResponse {
    client_id: String
}

async fn handle_websocket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    // handle new connections.
    let client_id = Uuid::now_v7().to_string();
    let response = ConnectResponse { client_id: client_id.clone() };
    let msg = serde_json::to_string(&response).expect("Unable to serialize response.");
    sender.send(Message::Text(Utf8Bytes::from(msg))).await.expect("Unable to send response.");

    // dispatch messages to web socket.
    let (message_queue_sender, mut message_queue_receiver) = tokio::sync::mpsc::unbounded_channel::<Message>();
    let dispatch_handle = tokio::spawn(async move {
       while let Some(message) = message_queue_receiver.recv().await {
           match sender.send(message).await {
               Ok(_) => {},
               Err(_) => {
                   println!("Unable to send message to websocket client.");
                   break;
               }
           }
       }
    });

    let mut topic_listeners: HashMap<Topic, tokio::task::JoinHandle<()>> = HashMap::new();

    // listen for messages from websocket client
    while let Some(Ok(message)) = receiver.next().await {
        // wait for message from websocket client
        if let Message::Text(content) = message {
            if let Ok(command) = serde_json::from_str::<WebSocketCommand>(&content) {
                match command.command {
                    Command::Subscribe(topic) => {                        
                        if !topic_listeners.contains_key(&topic) {
                            let mut rx = state.subscription_manager.write().await.subscribe(topic.clone(), client_id.clone());
                            // create a task to listen for events on this topic.
                            let message_queue_sender = message_queue_sender.clone();
                            let listen_handle = tokio::spawn(async move {
                                while let Ok(message) = rx.recv().await {
                                    let json = serde_json::to_string(&message).expect("Unable to serialize event.");
                                    let msg = Utf8Bytes::from(json);
                                    match message_queue_sender.send(Message::Text(msg)) {
                                        Ok(_) => {},
                                        Err(_) => {
                                            println!("Unable to send message to event queue.");
                                            break;
                                        }
                                    }
                                }
                            });

                            topic_listeners.insert(topic.clone(), listen_handle);
                        }
                    },
                    Command::Unsubscribe(topic) => {
                        if let Some(handle) = topic_listeners.remove(&topic) {
                            println!("Unsubscribe {} from: {}", client_id, topic);
                            handle.abort();
                            state.subscription_manager.write().await.unsubscribe(&client_id, &topic);
                        }
                    }
                }
            }
        }
    }

    // stop all tasks
    for handle in topic_listeners.values() {
        handle.abort();
    }
    state.subscription_manager.write().await.unsubscribe_client(&client_id);
    drop(message_queue_sender);
    let _ = dispatch_handle.await;
}
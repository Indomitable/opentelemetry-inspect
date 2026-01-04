use std::collections::HashMap;
use axum::body::Bytes;
use axum::extract::{State, WebSocketUpgrade};
use axum::extract::ws::{Message, Utf8Bytes, WebSocket};
use axum::response::IntoResponse;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::app_state::AppState;
use crate::subscription_manager::Topic;

pub async fn websocket_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
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
    // dispatch pong messages back to websocket client.
    let mut topic_listeners: HashMap<Topic, tokio::task::JoinHandle<()>> = HashMap::new();

    // listen for messages from websocket client
    while let Some(Ok(message)) = receiver.next().await {
        match message {
            Message::Binary(msg) => {
                if msg.len() == 1 && msg[0] == 0x09 {
                    let message_queue_sender = message_queue_sender.clone();
                    match message_queue_sender.send(Message::Binary(Bytes::from_static(&[0x0A]))) {
                        Ok(_) => {},
                        Err(_) => {
                            println!("Unable to send message to event queue.");
                            break;
                        }
                    }
                }
            },
            Message::Text(content) => {
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
            _ => {}
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

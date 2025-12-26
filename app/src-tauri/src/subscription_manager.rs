use std::collections::HashMap;
use serde::Serialize;
use tokio::sync::broadcast;
use tokio::sync::broadcast::Receiver;

pub type ClientId = String;
pub type Topic = String;

#[derive(Clone, Serialize, Debug)]
pub struct Message {
    pub topic: Topic,
    pub payload: String,
}

impl Message {
    pub fn new(topic: &str, payload: &str) -> Self {
        Message {
            topic: topic.to_string(),
            payload: payload.to_string()
        }
    }
}

#[derive(Clone)]
pub struct SubscriptionManager {
    subscribers: HashMap<Topic, Vec<ClientId>>,
    channels: HashMap<Topic, broadcast::Sender<Message>>
}

impl SubscriptionManager {
    pub fn new() -> Self {
        Self {
            subscribers: HashMap::new(),
            channels: HashMap::new()
        }
    }

    pub fn subscribe(&mut self, topic: Topic, client_id: ClientId) -> Receiver<Message> {
        self.subscribers
            .entry(topic.clone())
            .or_default()
            .push(client_id);

        let tx = self.channels
            .entry(topic)
            .or_insert_with(|| broadcast::channel(100).0);

        tx.subscribe()
    }

    pub fn unsubscribe(&mut self, client_id: &ClientId, topic: &Topic) {
        if let Some(subscribers) = self.subscribers.get_mut(topic) {
            subscribers.retain(|id| !id.eq(client_id));
            if subscribers.is_empty() {
                self.subscribers.remove(topic);
                self.channels.remove(topic);
            }
        }
    }

    pub fn unsubscribe_client(&mut self, client: &ClientId) {
        let topics = self.subscribers.keys().cloned().collect::<Vec<Topic>>();
        for topic in topics {
            self.unsubscribe(client, &topic);
        }
    }

    pub fn publish(&self, message: Message) -> Result<usize, broadcast::error::SendError<Message>> {
        if let Some(tx) = self.channels.get(&message.topic) {
            tx.send(message)
        } else {
            Ok(0)
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_subscribe() {
        let mut manager = SubscriptionManager::new();
        let mut r0 = manager.subscribe("test-topic".to_string(), "test-client".to_string());
        let mut r1 = manager.subscribe("test-topic".to_string(), "test-client-2".to_string());


        let w0 = tokio::spawn(async move {
            let msg= r0.recv().await.unwrap();
            msg
        });

        let w1 = tokio::spawn(async move {
            let msg= r1.recv().await.unwrap();
            msg
        });
        let message = Message::new("test-topic", "test");
        let res = manager.publish(message);

        assert!(res.is_ok());
        assert_eq!(2, res.unwrap());

        let (m0, m1) = tokio::join!(w0, w1);
        assert_eq!("test", m0.unwrap().payload);
        assert_eq!("test", m1.unwrap().payload);

        manager.unsubscribe_client(&"test-client".to_string());
        manager.unsubscribe_client(&"test-client-2".to_string());
    }

    #[tokio::test]
    async fn test_unsubscribe_client() {
        let mut manager = SubscriptionManager::new();
        let r = manager.subscribe("test-topic".to_string(), "test-client".to_string());

        let w0 = collect_messages(r);

        let message = Message::new("test-topic", "first");
        let res = manager.publish(message).unwrap();

        assert_eq!(1, res);
        manager.unsubscribe_client(&"test-client".to_string());
        let message = Message::new("test-topic", "second");
        let res = manager.publish(message).unwrap();
        assert_eq!(0, res);

        let messages = w0.await.unwrap();
        assert_eq!(1, messages.len());
    }
    
    #[tokio::test]
    async fn test_unsubscribe_topic() {
        let mut manager = SubscriptionManager::new();
        let r0 = manager.subscribe("test-topic-0".to_string(), "test-client".to_string());
        let r1 = manager.subscribe("test-topic-1".to_string(), "test-client".to_string());

        let w0 = collect_messages(r0);
        let w1 = collect_messages(r1);

        let message = Message::new("test-topic-0", "first");
        let res = manager.publish(message).unwrap();
        assert_eq!(1, res);
        let message = Message::new("test-topic-1", "first");
        let res = manager.publish(message).unwrap();
        assert_eq!(1, res);

        manager.unsubscribe(&"test-client".to_string(), &"test-topic-0".to_string());

        let message = Message::new("test-topic-0", "second");
        let res = manager.publish(message).unwrap();
        assert_eq!(0, res);
        let message = Message::new("test-topic-1", "second");
        let res = manager.publish(message).unwrap();
        assert_eq!(1, res);

        manager.unsubscribe_client(&"test-client".to_string());
        let (m0, m1) = tokio::join!(w0, w1);

        assert_eq!(1, m0.unwrap().len());
        assert_eq!(2, m1.unwrap().len());
    }

    fn collect_messages(mut receiver: Receiver<Message>) -> tokio::task::JoinHandle<Vec<Message>> {
        let handle = tokio::spawn(async move {
            let mut messages: Vec<Message> = Vec::new();
            while let Ok(msg) = receiver.recv().await {
                messages.push(msg);
            }
            messages
        });
        handle
    }
}
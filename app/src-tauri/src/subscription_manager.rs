use std::collections::HashMap;
use serde::Serialize;
use tokio::sync::broadcast;
use tokio::sync::broadcast::Receiver;
use crate::domain::logs::LogDto;

pub type ClientId = String;
pub type Topic = String;

#[derive(Clone, Serialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum TopicMessage {
    Logs { topic: String, payload: Box<LogDto> },
    Any { topic: String, payload: String }
}

impl TopicMessage {
    pub fn new(topic: &str, payload: &str) -> Self {
        TopicMessage::Any { topic: topic.to_string(), payload: payload.to_string() }
    }

    pub fn topic(&self) -> &str {
        match self {
            TopicMessage::Logs { topic, .. } => topic.as_str(),
            TopicMessage::Any { topic, .. } => topic.as_str(),
        }
    }
}

impl From<LogDto> for TopicMessage {
    fn from(value: LogDto) -> Self {
        TopicMessage::Logs { topic: "logs".to_string(), payload: Box::new(value) }
    }
}

#[derive(Clone)]
pub struct SubscriptionManager {
    subscribers: HashMap<Topic, Vec<ClientId>>,
    channels: HashMap<Topic, broadcast::Sender<TopicMessage>>
}

impl SubscriptionManager {
    pub fn new() -> Self {
        Self {
            subscribers: HashMap::new(),
            channels: HashMap::new()
        }
    }

    pub fn subscribe(&mut self, topic: Topic, client_id: ClientId) -> Receiver<TopicMessage> {
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

    pub fn publish(&self, topic: &str, payload: &str) -> Result<usize, broadcast::error::SendError<TopicMessage>> {
        let event = TopicMessage::new(topic, payload);
        if let Some(tx) = self.channels.get(event.topic()) {
            tx.send(event)
        } else {
            Ok(0)
        }
    }

    pub fn publish_logs(&self, payload: LogDto) -> Result<usize, broadcast::error::SendError<TopicMessage>> {
        let event = TopicMessage::from(payload);
        if let Some(tx) = self.channels.get(event.topic()) {
            tx.send(event)
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
        let res = manager.publish("test-topic", "test");

        assert!(res.is_ok());
        assert_eq!(2, res.unwrap());

        let (m0, m1) = tokio::join!(w0, w1);
        if let Ok(TopicMessage::Any { payload, .. }) = m0 {
            assert_eq!("test", payload);
        } else {
            panic!("Expected topic message");
        }
        if let Ok(TopicMessage::Any { payload, .. }) = m1 {
            assert_eq!("test", payload);
        } else {
            panic!("Expected topic message");
        }

        manager.unsubscribe_client(&"test-client".to_string());
        manager.unsubscribe_client(&"test-client-2".to_string());
    }

    #[tokio::test]
    async fn test_unsubscribe_client() {
        let mut manager = SubscriptionManager::new();
        let r = manager.subscribe("test-topic".to_string(), "test-client".to_string());

        let w0 = collect_messages(r);

        let res = manager.publish("test-topic", "first").unwrap();

        assert_eq!(1, res);
        manager.unsubscribe_client(&"test-client".to_string());
        let res = manager.publish("test-topic", "second").unwrap();
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

        let res = manager.publish("test-topic-0", "first").unwrap();
        assert_eq!(1, res);
        let res = manager.publish("test-topic-1", "first").unwrap();
        assert_eq!(1, res);

        manager.unsubscribe(&"test-client".to_string(), &"test-topic-0".to_string());

        let res = manager.publish("test-topic-0", "second").unwrap();
        assert_eq!(0, res);
        let res = manager.publish("test-topic-1", "second").unwrap();
        assert_eq!(1, res);

        manager.unsubscribe_client(&"test-client".to_string());
        let (m0, m1) = tokio::join!(w0, w1);

        assert_eq!(1, m0.unwrap().len());
        assert_eq!(2, m1.unwrap().len());
    }

    fn collect_messages(mut receiver: Receiver<TopicMessage>) -> tokio::task::JoinHandle<Vec<TopicMessage>> {
        let handle = tokio::spawn(async move {
            let mut messages: Vec<TopicMessage> = Vec::new();
            while let Ok(msg) = receiver.recv().await {
                messages.push(msg);
            }
            messages
        });
        handle
    }
}
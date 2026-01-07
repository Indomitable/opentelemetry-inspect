#[allow(unused)]
use std::collections::HashMap;
use serde::Serialize;
use tokio::sync::broadcast;
use tokio::sync::broadcast::Receiver;
use crate::domain::logs::LogDto;
use crate::domain::metrics::MetricDto;
use crate::domain::traces::SpanDto;

pub type ClientId = String;
pub type Topic = String;

#[derive(Clone, Serialize, Debug)]
#[serde(untagged)] // no need to deserialize so we can use untagged
pub(crate) enum TopicMessage {
    Logs { topic: String, payload: Box<LogDto> },
    Spans { topic: String, payload: Box<SpanDto> },
    Metrics { topic: String, payload: Box<MetricDto> },
    #[allow(dead_code)] // use any for testing purposes
    Any { topic: String, payload: String }
}

impl TopicMessage {
    #[allow(dead_code)]
    pub fn new(topic: &str, payload: &str) -> Self {
        TopicMessage::Any { topic: topic.to_string(), payload: payload.to_string() }
    }

    pub fn topic(&self) -> &str {
        match self {
            TopicMessage::Logs { topic, .. } => topic.as_str(),
            TopicMessage::Spans { topic, .. } => topic.as_str(),
            TopicMessage::Metrics { topic, .. } => topic.as_str(),
            TopicMessage::Any { topic, .. } => topic.as_str(),
        }
    }
}

impl From<LogDto> for TopicMessage {
    fn from(value: LogDto) -> Self {
        TopicMessage::Logs { topic: "logs".to_string(), payload: Box::new(value) }
    }
}

impl From<SpanDto> for TopicMessage {
    fn from(value: SpanDto) -> Self {
        TopicMessage::Spans { topic: "traces".to_string(), payload: Box::new(value) }
    }
}

impl From<MetricDto> for TopicMessage {
    fn from(value: MetricDto) -> Self {
        TopicMessage::Metrics { topic: "metrics".to_string(), payload: Box::new(value) }
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

    #[allow(dead_code)]
    pub fn publish(&self, topic: &str, payload: &str) -> Result<usize, broadcast::error::SendError<TopicMessage>> {
        let event = TopicMessage::new(topic, payload);
        if let Some(tx) = self.channels.get(event.topic()) {
            tx.send(event)
        } else {
            Ok(0)
        }
    }

    pub fn publish_log(&self, payload: LogDto) -> Result<usize, broadcast::error::SendError<TopicMessage>> {
        let event = TopicMessage::from(payload);
        if let Some(tx) = self.channels.get(event.topic()) {
            tx.send(event)
        } else {
            Ok(0)
        }
    }

    pub fn publish_span(&self, payload: SpanDto) -> Result<usize, broadcast::error::SendError<TopicMessage>> {
        let event = TopicMessage::from(payload);
        if let Some(tx) = self.channels.get(event.topic()) {
            tx.send(event)
        } else {
            Ok(0)
        }
    }

    pub fn publish_metric(&self, payload: MetricDto) -> Result<usize, broadcast::error::SendError<TopicMessage>> {
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
    use chrono::{TimeZone, Utc};
    use crate::domain::logs::Severity;
    use crate::domain::resource::ResourceInfo;
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

    #[test]
    fn test_message_serialization() {
        let log = LogDto {
            timestamp: Utc.with_ymd_and_hms(2025, 1, 12, 14, 23, 20).unwrap(),
            time_unix_nano: "1641996200000000000".to_string(),
            message: "test".to_string(),
            scope: "TestScope".to_string(),
            severity: Severity::Error,
            tags: HashMap::new(),
            resource: ResourceInfo {
                service_name: "test service".to_string(),
                service_version: "1.0".to_string(),
                service_namespace: "test".to_string(),
                service_instance_id: "1-2-3".to_string(),
                attributes: HashMap::new()
            },
            event_name: None,
            span_id: None,
            trace_id: None
        };
        let message = TopicMessage::from(log);
        let json = serde_json::to_string_pretty(&message).unwrap();
        //lang=JSON
        assert_eq!(r#"{
  "topic": "logs",
  "payload": {
    "timestamp": "2025-01-12T14:23:20Z",
    "time_unix_nano": "1641996200000000000",
    "severity": "Error",
    "message": "test",
    "scope": "TestScope",
    "resource": {
      "service_name": "test service",
      "service_version": "1.0",
      "service_namespace": "test",
      "service_instance_id": "1-2-3",
      "attributes": {}
    },
    "tags": {}
  }
}"#, json);
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
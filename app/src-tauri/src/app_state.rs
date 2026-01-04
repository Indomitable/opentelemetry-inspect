use std::sync::Arc;
use tokio::sync::RwLock;
use crate::subscription_manager::SubscriptionManager;

#[derive(Clone)]
pub(crate) struct AppState {
    pub subscription_manager: Arc<RwLock<SubscriptionManager>>
}

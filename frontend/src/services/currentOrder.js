const eventName = "canteen-current-order-change";

const storageKey = (userId) => `canteen-current-order:${userId}`;

export const getCurrentOrderId = (userId) => {
  if (!userId) return "";
  try {
    return localStorage.getItem(storageKey(userId)) || "";
  } catch {
    return "";
  }
};

export const setCurrentOrderId = (userId, orderId) => {
  if (!userId || !orderId) return;
  try {
    localStorage.setItem(storageKey(userId), String(orderId));
    window.dispatchEvent(new Event(eventName));
  } catch {
    // Tracking still works from its route even when storage is unavailable.
  }
};

export const clearCurrentOrderId = (userId, orderId) => {
  if (!userId || !orderId || getCurrentOrderId(userId) !== String(orderId)) return;
  try {
    localStorage.removeItem(storageKey(userId));
    window.dispatchEvent(new Event(eventName));
  } catch {
    // A stale navigation shortcut is harmless if storage is unavailable.
  }
};

export const CURRENT_ORDER_EVENT = eventName;

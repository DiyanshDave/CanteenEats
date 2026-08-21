import Order from "../models/Order.js";

const AVERAGE_PREP_MINUTES = 5;
const KITCHEN_QUEUE_STATUSES = ["QUEUED", "PREPARING"];
const ACTIVE_STATUSES = ["QUEUED", "PREPARING", "READY"];

// Allowed forward transitions for staff-managed order status updates
const VALID_TRANSITIONS = {
  QUEUED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Generates the next sequential daily token (A01, A02, ... A100, ...), resetting each day
async function generateNextToken() {
  const { start, end } = getTodayRange();

  const count = await Order.countDocuments({
    createdAt: { $gte: start, $lt: end },
  });

  const sequence = count + 1;
  return `A${String(sequence).padStart(2, "0")}`;
}

// Creates an order with a unique daily token, retrying on rare token collisions.
// This keeps token assignment simple/reliable without adding a separate Queue collection.
export async function createOrderWithToken(orderData) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const token = await generateNextToken();

    try {
      const order = await Order.create({ ...orderData, token });
      return order;
    } catch (err) {
      // Duplicate token from a near-simultaneous request - retry with a fresh token
      if (err.code === 11000 && err.keyPattern && err.keyPattern.token) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to assign a unique queue token after multiple attempts");
}

// Computes live queue position, wait estimate, and active order counts for a given order
export async function getQueueInfo(order) {
  const activeOrders = await Order.find({
    status: { $in: ACTIVE_STATUSES },
  }).select("_id status createdAt");

  const totalActiveOrders = activeOrders.length;

  const kitchenQueueOrders = activeOrders
    .filter((o) => KITCHEN_QUEUE_STATUSES.includes(o.status))
    .sort((a, b) => a.createdAt - b.createdAt);

  let position = null;
  let numberOfOrdersAhead = 0;
  let estimatedWaitMinutes = 0;

  if (KITCHEN_QUEUE_STATUSES.includes(order.status)) {
    const index = kitchenQueueOrders.findIndex(
      (o) => o._id.toString() === order._id.toString()
    );
    numberOfOrdersAhead = index >= 0 ? index : 0;
    position = numberOfOrdersAhead + 1;
    estimatedWaitMinutes = (numberOfOrdersAhead + 1) * AVERAGE_PREP_MINUTES;
  }
  // READY / COMPLETED / CANCELLED orders are no longer waiting on kitchen prep,
  // so position stays null and estimatedWaitMinutes stays 0.

  return {
    orderId: order._id,
    token: order.token,
    status: order.status,
    position,
    estimatedWaitMinutes,
    numberOfOrdersAhead,
    totalActiveOrders,
  };
}

// Checks whether moving from currentStatus to nextStatus is a permitted transition
export function isValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export { AVERAGE_PREP_MINUTES, KITCHEN_QUEUE_STATUSES, ACTIVE_STATUSES };
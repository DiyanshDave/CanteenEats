import Order from "../models/Order.js";

const AVERAGE_PREP_MINUTES = 5;
const TOKEN_TIME_ZONE = "Asia/Kolkata";
const KITCHEN_QUEUE_STATUSES = ["QUEUED", "PREPARING"];
const ACTIVE_STATUSES = ["QUEUED", "PREPARING", "READY"];

// Allowed forward transitions for staff-managed order status updates
const VALID_TRANSITIONS = {
  QUEUED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function getTodayRange() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TOKEN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).map(({ type, value }) => [type, value])
  );
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+05:30`);
  return { start };
}

// Generates the next sequential daily token (A01, A02, ... A100, ...), resetting each day
async function generateNextToken() {
  const { start } = getTodayRange();

  const count = await Order.countDocuments({ tokenDate: start, token: { $type: "string" } });

  const sequence = count + 1;
  return { token: `A${String(sequence).padStart(2, "0")}`, tokenDate: start };
}

// Creates an order with a unique daily token, retrying on rare token collisions.
// This keeps token assignment simple/reliable without adding a separate Queue collection.
export async function createOrderWithToken(orderData) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { token, tokenDate } = await generateNextToken();
      const order = await Order.create({ ...orderData, token, tokenDate });
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

// Assigns a queue token to an already-paid pending order. A conditional update
// makes simultaneous callback and webhook delivery safe and idempotent.
export async function queuePaidOrder(orderId) {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { token, tokenDate } = await generateNextToken();
    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: "PENDING_PAYMENT",
          paymentStatus: "PAID",
          token: { $exists: false },
        },
        { $set: { token, tokenDate, status: "QUEUED", queuedAt: new Date() } },
        { new: true }
      );

      if (order) {
        const queueInfo = await getQueueInfo(order);
        order.estimatedWaitMinutes = queueInfo.estimatedWaitMinutes;
        await order.save();
        return order;
      }

      const existing = await Order.findById(orderId);
      if (existing?.paymentStatus === "PAID" && existing.token) {
        if (existing.status === "QUEUED" && existing.estimatedWaitMinutes == null) {
          const queueInfo = await getQueueInfo(existing);
          existing.estimatedWaitMinutes = queueInfo.estimatedWaitMinutes;
          await existing.save();
        }
        return existing;
      }
      return null;
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.token) continue;
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

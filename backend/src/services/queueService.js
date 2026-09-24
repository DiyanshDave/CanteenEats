import Order from "../models/Order.js";
import {
  calculateCalibrationFactor,
  estimateBasePreparationMinutes,
  formatQueueInfo,
  scheduleKitchenOrders,
} from "./etaModel.js";

const TOKEN_TIME_ZONE = "Asia/Kolkata";
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
        order.estimatedReadyAt = queueInfo.estimatedReadyAt;
        await order.save();
        return order;
      }

      const existing = await Order.findById(orderId);
      if (existing?.paymentStatus === "PAID" && existing.token) {
        if (existing.status === "QUEUED" && existing.estimatedWaitMinutes == null) {
          const queueInfo = await getQueueInfo(existing);
          existing.estimatedWaitMinutes = queueInfo.estimatedWaitMinutes;
          existing.estimatedReadyAt = queueInfo.estimatedReadyAt;
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

const paidOrLegacyFilter = {
  $or: [{ paymentStatus: "PAID" }, { paymentStatus: { $exists: false } }],
};
const activeOrderProjection = "_id status paymentStatus token createdAt queuedAt preparingAt readyAt items";
const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 200;
const CALIBRATION_CACHE_MS = 60 * 1000;
let calibrationCache = { factor: 1, expiresAt: 0 };

export function getKitchenParallelCapacity() {
  const configured = Number(process.env.KITCHEN_PARALLEL_CAPACITY);
  return Number.isInteger(configured) && configured > 0 ? configured : 2;
}

async function getHistoricalCalibrationFactor() {
  if (calibrationCache.expiresAt > Date.now()) return calibrationCache.factor;

  try {
    const since = new Date(Date.now() - HISTORY_WINDOW_MS);
    const history = await Order.find({
      status: { $in: ["READY", "COMPLETED"] },
      preparingAt: { $type: "date", $gte: since },
      readyAt: { $type: "date" },
      ...paidOrLegacyFilter,
    })
      .select("items preparingAt readyAt")
      .sort({ readyAt: -1 })
      .limit(HISTORY_LIMIT)
      .populate("items.product", "prepTimeMinutes");

    const calibrationData = history.map((order) => ({
      actualDurationMinutes: (new Date(order.readyAt) - new Date(order.preparingAt)) / 60_000,
      baselineDurationMinutes: estimateBasePreparationMinutes(order.items),
    }));
    calibrationCache = {
      factor: calculateCalibrationFactor(calibrationData),
      expiresAt: Date.now() + CALIBRATION_CACHE_MS,
    };
  } catch {
    calibrationCache = { factor: 1, expiresAt: Date.now() + CALIBRATION_CACHE_MS };
  }
  return calibrationCache.factor;
}

async function loadActiveOrders() {
  return Order.find({
    status: { $in: ACTIVE_STATUSES },
    ...paidOrLegacyFilter,
  })
    .select(activeOrderProjection)
    .populate("items.product", "prepTimeMinutes")
    .lean();
}

async function calculateQueueInfos(requestedOrders, activeOrders) {
  const targetRequiresEstimate = requestedOrders.some((order) => ["QUEUED", "PREPARING"].includes(order.status));
  const factor = targetRequiresEstimate ? await getHistoricalCalibrationFactor() : 1;
  const now = new Date();
  const schedule = scheduleKitchenOrders({
    orders: activeOrders,
    capacity: getKitchenParallelCapacity(),
    calibrationFactor: factor,
    now,
  });
  return new Map(requestedOrders.map((order) => [
    String(order._id || order.id),
    formatQueueInfo(order, schedule, now),
  ]));
}

// The individual student endpoint uses a fresh queue snapshot on every request.
export async function getQueueInfo(order) {
  const activeOrders = await loadActiveOrders();
  const infos = await calculateQueueInfos([order], activeOrders);
  return infos.get(String(order._id || order.id));
}

// Staff views pass their current active-order snapshot to avoid querying and
// recalculating the same kitchen state once per card.
export async function getQueueInfosForOrders(orders) {
  const infos = await calculateQueueInfos(orders, orders);
  return infos;
}

// Checks whether moving from currentStatus to nextStatus is a permitted transition
export function isValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export { ACTIVE_STATUSES };

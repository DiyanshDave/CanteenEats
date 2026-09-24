export const DEFAULT_PREP_TIME_MINUTES = 5;
export const MIN_PREP_TIME_MINUTES = 3;
export const MAX_PREP_TIME_MINUTES = 60;
export const MIN_CALIBRATION_FACTOR = 0.75;
export const MAX_CALIBRATION_FACTOR = 1.5;

const finitePositive = (value, fallback = DEFAULT_PREP_TIME_MINUTES) => (
  Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback
);

function itemPrepTime(item) {
  return finitePositive(
    item.prepTimeMinutesSnapshot ?? item.product?.prepTimeMinutes
  );
}

// Parallel components share kitchen time; batch quantities add a smaller
// incremental workload, and distinct products add a coordination allowance.
export function estimateBasePreparationMinutes(items = []) {
  const products = new Map();
  for (const [index, item] of items.entries()) {
    const identity = String(item.product?._id || item.product || item.nameSnapshot || index);
    const current = products.get(identity) || { prepTime: itemPrepTime(item), quantity: 0 };
    current.prepTime = Math.max(current.prepTime, itemPrepTime(item));
    current.quantity += Math.max(1, Math.floor(finitePositive(item.quantity, 1)));
    products.set(identity, current);
  }

  if (!products.size) return MIN_PREP_TIME_MINUTES;

  const workloads = [...products.values()].sort((a, b) => b.prepTime - a.prepTime);
  const primary = workloads[0].prepTime;
  const secondaryParallelWork = workloads
    .slice(1)
    .reduce((total, item) => total + item.prepTime * 0.35, 0);
  const additionalQuantityWork = workloads
    .reduce((total, item) => total + item.prepTime * 0.35 * (item.quantity - 1), 0);
  const coordinationWork = Math.max(0, workloads.length - 1) * 1.25;
  const estimate = primary + secondaryParallelWork + additionalQuantityWork + coordinationWork;

  return Math.min(MAX_PREP_TIME_MINUTES, Math.max(MIN_PREP_TIME_MINUTES, estimate));
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function calculateCalibrationFactor(history = [], minimumSamples = 5) {
  const ratios = history
    .filter((entry) => (
      Number.isFinite(entry.actualDurationMinutes) &&
      entry.actualDurationMinutes > 0 &&
      Number.isFinite(entry.baselineDurationMinutes) &&
      entry.baselineDurationMinutes > 0
    ))
    .map((entry) => entry.actualDurationMinutes / entry.baselineDurationMinutes);

  if (ratios.length < minimumSamples) return 1;
  return Math.min(
    MAX_CALIBRATION_FACTOR,
    Math.max(MIN_CALIBRATION_FACTOR, median(ratios))
  );
}

export function estimatePreparationMinutes(items, calibrationFactor = 1) {
  const factor = Math.min(
    MAX_CALIBRATION_FACTOR,
    Math.max(MIN_CALIBRATION_FACTOR, finitePositive(calibrationFactor, 1))
  );
  const estimate = estimateBasePreparationMinutes(items) * factor;
  return Math.min(MAX_PREP_TIME_MINUTES, Math.max(MIN_PREP_TIME_MINUTES, estimate));
}

function orderTime(order, field, fallbackField) {
  const value = order[field] || order[fallbackField];
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function orderIdentity(order) {
  return String(order._id || order.id);
}

const isPaidOrLegacy = (order) => order.paymentStatus === "PAID" || order.paymentStatus == null;

// Schedules queued jobs FIFO against the earliest available virtual kitchen slot.
export function scheduleKitchenOrders({ orders = [], capacity = 2, calibrationFactor = 1, now = new Date() }) {
  const kitchenCapacity = Number.isInteger(capacity) && capacity > 0 ? capacity : 2;
  const nowMs = new Date(now).getTime();
  const active = orders.filter((order) => (
    isPaidOrLegacy(order) && ["PREPARING", "QUEUED", "READY"].includes(order.status)
  ));
  const preparing = active
    .filter((order) => order.status === "PREPARING")
    .sort((a, b) => orderTime(a, "preparingAt", "createdAt") - orderTime(b, "preparingAt", "createdAt"));
  const queued = active
    .filter((order) => order.status === "QUEUED")
    .sort((a, b) => {
      const difference = orderTime(a, "queuedAt", "createdAt") - orderTime(b, "queuedAt", "createdAt");
      return difference || orderIdentity(a).localeCompare(orderIdentity(b));
    });

  const slots = Array(kitchenCapacity).fill(0);
  const estimates = new Map();
  const earliestSlot = () => slots.reduce(
    (earliest, workload, index) => workload < slots[earliest] ? index : earliest,
    0
  );

  for (const order of preparing) {
    const duration = estimatePreparationMinutes(order.items, calibrationFactor);
    const preparingAt = order.preparingAt ? new Date(order.preparingAt).getTime() : nowMs;
    const elapsed = Math.max(0, (nowMs - preparingAt) / 60_000);
    const remaining = Math.max(duration - elapsed, 0);
    const slot = earliestSlot();
    // Orders already in progress remain in progress even if capacity was reduced.
    slots[slot] = Math.max(slots[slot], remaining);
    estimates.set(orderIdentity(order), {
      estimatedPreparationMinutes: duration,
      estimatedWaitMinutes: remaining,
      estimatedReadyAt: new Date(nowMs + remaining * 60_000),
      position: null,
      numberOfOrdersAhead: 0,
    });
  }

  queued.forEach((order, index) => {
    const duration = estimatePreparationMinutes(order.items, calibrationFactor);
    const slot = earliestSlot();
    const startAfterMinutes = slots[slot];
    const waitMinutes = startAfterMinutes + duration;
    slots[slot] = waitMinutes;
    estimates.set(orderIdentity(order), {
      estimatedPreparationMinutes: duration,
      estimatedWaitMinutes: waitMinutes,
      estimatedReadyAt: new Date(nowMs + waitMinutes * 60_000),
      position: index + 1,
      numberOfOrdersAhead: index,
    });
  });

  return { estimates, totalActiveOrders: active.length, kitchenParallelCapacity: kitchenCapacity };
}

export function formatQueueInfo(order, schedule, now = new Date()) {
  const estimate = schedule.estimates.get(String(order._id || order.id));
  const isPendingPayment = order.status === "PENDING_PAYMENT";
  const isReady = order.status === "READY" || order.status === "COMPLETED";
  const hasSchedule = ["QUEUED", "PREPARING"].includes(order.status) && estimate;
  const wait = hasSchedule ? Math.ceil(estimate.estimatedWaitMinutes) : isReady ? 0 : null;

  return {
    orderId: order._id || order.id,
    token: order.token || null,
    status: order.status,
    position: hasSchedule ? estimate.position : null,
    estimatedWaitMinutes: wait,
    numberOfOrdersAhead: hasSchedule ? estimate.numberOfOrdersAhead : isPendingPayment ? null : 0,
    totalActiveOrders: schedule.totalActiveOrders,
    estimatedReadyAt: hasSchedule
      ? estimate.estimatedReadyAt
      : isReady
        ? order.readyAt || now
        : null,
    estimatedPreparationMinutes: hasSchedule
      ? Math.round(estimate.estimatedPreparationMinutes * 10) / 10
      : null,
    kitchenParallelCapacity: schedule.kitchenParallelCapacity,
  };
}

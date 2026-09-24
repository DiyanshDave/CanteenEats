import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCalibrationFactor,
  estimateBasePreparationMinutes,
  estimatePreparationMinutes,
  formatQueueInfo,
  scheduleKitchenOrders,
} from "../src/services/etaModel.js";
import { getKitchenParallelCapacity } from "../src/services/queueService.js";
import demoMenu from "../src/data/demoMenu.js";

const item = (minutes, quantity = 1, product = "p1") => ({
  product,
  prepTimeMinutesSnapshot: minutes,
  quantity,
});

const order = (id, status, items, values = {}) => ({
  _id: id,
  status,
  paymentStatus: "PAID",
  items,
  createdAt: new Date("2026-09-25T09:00:00Z"),
  ...values,
});

test("one queued order with no preparing workload uses its item duration", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const result = scheduleKitchenOrders({
    orders: [order("q1", "QUEUED", [item(8)])],
    capacity: 2,
    now,
  });
  assert.equal(result.estimates.get("q1").estimatedWaitMinutes, 8);
  assert.equal(result.estimates.get("q1").position, 1);
});

test("queued ETA includes a preparing order's remaining work", () => {
  const now = new Date("2026-09-25T10:03:00Z");
  const result = scheduleKitchenOrders({
    orders: [
      order("p1", "PREPARING", [item(8)], { preparingAt: new Date("2026-09-25T10:00:00Z") }),
      order("q1", "QUEUED", [item(5)]),
    ],
    capacity: 1,
    now,
  });
  assert.equal(result.estimates.get("p1").estimatedWaitMinutes, 5);
  assert.equal(result.estimates.get("q1").estimatedWaitMinutes, 10);
});

test("two preparing orders seed two slots and queued work uses the earliest one", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const result = scheduleKitchenOrders({
    orders: [
      order("p1", "PREPARING", [item(8)], { preparingAt: now }),
      order("p2", "PREPARING", [item(4)], { preparingAt: now }),
      order("q1", "QUEUED", [item(5)]),
    ],
    capacity: 2,
    now,
  });
  assert.equal(result.estimates.get("q1").estimatedWaitMinutes, 9);
});

test("FIFO jobs get stable positions while using the earliest free slot", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const result = scheduleKitchenOrders({
    orders: [
      order("p1", "PREPARING", [item(4)], { preparingAt: now }),
      order("q1", "QUEUED", [item(10)], { queuedAt: new Date("2026-09-25T10:01:00Z") }),
      order("q2", "QUEUED", [item(6)], { queuedAt: new Date("2026-09-25T10:02:00Z") }),
      order("q3", "QUEUED", [item(3)], { queuedAt: new Date("2026-09-25T10:03:00Z") }),
    ],
    capacity: 2,
    now,
  });
  assert.deepEqual(
    ["q1", "q2", "q3"].map((id) => result.estimates.get(id).position),
    [1, 2, 3]
  );
  assert.deepEqual(
    ["q1", "q2", "q3"].map((id) => result.estimates.get(id).estimatedWaitMinutes),
    [10, 10, 13]
  );
});

test("quantity increases preparation duration with diminishing increments", () => {
  const one = estimateBasePreparationMinutes([item(8, 1)]);
  const three = estimateBasePreparationMinutes([item(8, 3)]);
  assert.equal(one, 8);
  assert.ok(three > one);
  assert.ok(three < one * 3);
});

test("distinct menu items add coordination time and all demo items define prep times", () => {
  const oneItem = estimateBasePreparationMinutes([item(8, 1, "p1")]);
  const combo = estimateBasePreparationMinutes([item(8, 1, "p1"), item(5, 1, "p2")]);
  assert.ok(combo > oneItem);
  assert.ok(combo < 13);
  assert.ok(demoMenu.every((product) => Number.isFinite(product.prepTimeMinutes) && product.prepTimeMinutes > 0));
});

test("recent history calibrates with a median and clamps extreme factors", () => {
  const history = [1.2, 1.25, 1.3, 1.2, 4].map((ratio) => ({
    baselineDurationMinutes: 10,
    actualDurationMinutes: 10 * ratio,
  }));
  assert.equal(calculateCalibrationFactor(history), 1.25);
  assert.equal(calculateCalibrationFactor(Array(5).fill({ baselineDurationMinutes: 10, actualDurationMinutes: 30 })), 1.5);
  assert.equal(calculateCalibrationFactor(Array(5).fill({ baselineDurationMinutes: 10, actualDurationMinutes: 2 })), 0.75);
  assert.equal(estimatePreparationMinutes([item(8)], 1.25), 10);
});

test("insufficient or invalid history uses the deterministic baseline", () => {
  assert.equal(calculateCalibrationFactor([]), 1);
  assert.equal(calculateCalibrationFactor([
    { baselineDurationMinutes: 0, actualDurationMinutes: 6 },
    { baselineDurationMinutes: 4, actualDurationMinutes: -1 },
  ]), 1);
  assert.equal(estimatePreparationMinutes([item(7)]), 7);
});

test("pending, ready, completed, and cancelled orders do not occupy prep slots", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const result = scheduleKitchenOrders({
    orders: [
      order("pending", "PENDING_PAYMENT", [item(30)]),
      order("ready", "READY", [item(30)]),
      order("done", "COMPLETED", [item(30)]),
      order("cancelled", "CANCELLED", [item(30)]),
      order("q1", "QUEUED", [item(5)]),
    ],
    capacity: 1,
    now,
  });
  assert.equal(result.totalActiveOrders, 2);
  assert.equal(result.estimates.has("pending"), false);
  assert.equal(result.estimates.get("q1").estimatedWaitMinutes, 5);
});

test("queue response semantics keep payment pending outside the queue and ready at zero", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const schedule = scheduleKitchenOrders({
    orders: [order("q1", "QUEUED", [item(5)])],
    capacity: 2,
    now,
  });
  const pending = formatQueueInfo(order("pending", "PENDING_PAYMENT", [item(20)]), schedule, now);
  const ready = formatQueueInfo(order("ready", "READY", [item(20)], { readyAt: now }), schedule, now);
  const cancelled = formatQueueInfo(order("cancelled", "CANCELLED", [item(20)]), schedule, now);

  assert.equal(pending.position, null);
  assert.equal(pending.numberOfOrdersAhead, null);
  assert.equal(pending.estimatedWaitMinutes, null);
  assert.equal(pending.estimatedReadyAt, null);
  assert.equal(ready.estimatedWaitMinutes, 0);
  assert.equal(ready.estimatedReadyAt.getTime(), now.getTime());
  assert.equal(cancelled.estimatedWaitMinutes, null);
  assert.equal(cancelled.estimatedReadyAt, null);
});

test("ETA falls as elapsed preparation time increases and changes for preparing orders", () => {
  const startedAt = new Date("2026-09-25T10:00:00Z");
  const active = order("p1", "PREPARING", [item(10)], { preparingAt: startedAt });
  const queued = order("q1", "QUEUED", [item(5)]);
  const initial = scheduleKitchenOrders({ orders: [active, queued], capacity: 1, now: startedAt });
  const later = scheduleKitchenOrders({
    orders: [active, queued],
    capacity: 1,
    now: new Date(startedAt.getTime() + 2 * 60_000),
  });
  assert.equal(initial.estimates.get("p1").estimatedWaitMinutes, 10);
  assert.equal(later.estimates.get("p1").estimatedWaitMinutes, 8);
  assert.equal(initial.estimates.get("q1").estimatedWaitMinutes, 15);
  assert.equal(later.estimates.get("q1").estimatedWaitMinutes, 13);
});

test("missing preparingAt falls back to a full estimate without writing a timestamp", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const preparing = order("p1", "PREPARING", [item(6)]);
  const result = scheduleKitchenOrders({ orders: [preparing], capacity: 1, now });
  assert.equal(result.estimates.get("p1").estimatedWaitMinutes, 6);
  assert.equal(preparing.preparingAt, undefined);
});

test("kitchen capacity reads the environment and defaults to two slots", () => {
  const original = process.env.KITCHEN_PARALLEL_CAPACITY;
  try {
    delete process.env.KITCHEN_PARALLEL_CAPACITY;
    assert.equal(getKitchenParallelCapacity(), 2);
    process.env.KITCHEN_PARALLEL_CAPACITY = "3";
    assert.equal(getKitchenParallelCapacity(), 3);
    process.env.KITCHEN_PARALLEL_CAPACITY = "invalid";
    assert.equal(getKitchenParallelCapacity(), 2);
  } finally {
    if (original === undefined) delete process.env.KITCHEN_PARALLEL_CAPACITY;
    else process.env.KITCHEN_PARALLEL_CAPACITY = original;
  }
});

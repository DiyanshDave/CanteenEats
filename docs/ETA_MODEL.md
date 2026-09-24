# Queue ETA Model

The ETA is a deterministic kitchen schedule, not a machine-learning prediction. It estimates each order's preparation workload from product preparation times, then places queued orders on the earliest available virtual kitchen slot while retaining FIFO assignment order.

## Order preparation estimate

For each order, the baseline is:

`longest item time + 35% of other distinct item times + 35% of each extra unit's item time + 1.25 minutes per additional distinct item`

The result is clamped to 3–60 minutes. Order item preparation times are snapshotted at checkout; old orders fall back to the current product value or five minutes.

## Historical calibration

The backend compares the baseline with `readyAt - preparingAt` for paid (and legacy) READY/COMPLETED orders from the last 30 days, considering at most the 200 most recent eligible orders. With at least five samples it uses the median actual-to-baseline ratio, clamped to 0.75–1.50. Less history uses a factor of 1. The factor is cached for one minute; no historical order timestamps are created or changed.

## Scheduling and updates

`KITCHEN_PARALLEL_CAPACITY` sets the virtual slot count (default 2). Current PREPARING orders seed those slots with their estimated remaining duration, calculated from `preparingAt`. FIFO QUEUED orders are assigned to the earliest slot; their predicted ready time is slot availability plus their calibrated preparation estimate. Student and staff queue responses calculate from a fresh active-order snapshot, so ETAs change as preparation progresses or statuses change. PENDING_PAYMENT, READY, COMPLETED, and CANCELLED orders do not consume preparation slots.

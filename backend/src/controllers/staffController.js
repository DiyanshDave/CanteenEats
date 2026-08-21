import Order from "../models/Order.js";

const STUDENT_SAFE_FIELDS = "name email role";
const PRODUCT_SAFE_FIELDS = "name price category image isAvailable";

const ACTIVE_KITCHEN_STATUSES = ["QUEUED", "PREPARING", "READY"];
const VALID_STATUSES = [
  "PLACED",
  "QUEUED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

export const getStaffOrders = async (req, res, next) => {
  try {
    const { status } = req.query;

    let filter;
    let sort;

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid status value",
        });
      }
      filter = { status };
    } else {
      filter = { status: { $in: ACTIVE_KITCHEN_STATUSES } };
    }

    // QUEUED -> earliest created first (matches token sequence order)
    // PREPARING / READY -> earliest updatedAt first (best available proxy for
    // when the order entered that status, without redesigning the schema)
    // Any other explicit status filter -> default to createdAt ascending
    if (!status || status === "QUEUED") {
      sort = { createdAt: 1 };
    } else if (status === "PREPARING" || status === "READY") {
      sort = { updatedAt: 1 };
    } else {
      sort = { createdAt: 1 };
    }

    const orders = await Order.find(filter)
      .populate("user", STUDENT_SAFE_FIELDS)
      .populate("items.product", PRODUCT_SAFE_FIELDS)
      .sort(sort);

    res.status(200).json({
      status: "success",
      count: orders.length,
      orders,
    });
  } catch (err) {
    next(err);
  }
};

export const getStaffOrdersSummary = async (req, res, next) => {
  try {
    const results = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      queuedCount: 0,
      preparingCount: 0,
      readyCount: 0,
      completedCount: 0,
      cancelledCount: 0,
    };

    const statusToKey = {
      QUEUED: "queuedCount",
      PREPARING: "preparingCount",
      READY: "readyCount",
      COMPLETED: "completedCount",
      CANCELLED: "cancelledCount",
    };

    for (const result of results) {
      const key = statusToKey[result._id];
      if (key) {
        summary[key] = result.count;
      }
    }

    res.status(200).json({
      status: "success",
      summary,
    });
  } catch (err) {
    next(err);
  }
};

export const getStaffOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", STUDENT_SAFE_FIELDS)
      .populate("items.product", PRODUCT_SAFE_FIELDS);

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    res.status(200).json({
      status: "success",
      order,
    });
  } catch (err) {
    next(err);
  }
};

export const getStaffQueue = async (req, res, next) => {
  try {
    const activeOrders = await Order.find({
      status: { $in: ACTIVE_KITCHEN_STATUSES },
    }).populate("items.product", PRODUCT_SAFE_FIELDS);

    const queued = activeOrders
      .filter((o) => o.status === "QUEUED")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((o) => ({
        token: o.token,
        orderId: o._id,
        items: o.items,
        estimatedWaitMinutes: o.estimatedWaitMinutes,
        createdAt: o.createdAt,
      }));

    const preparing = activeOrders
      .filter((o) => o.status === "PREPARING")
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((o) => ({
        token: o.token,
        orderId: o._id,
        items: o.items,
        createdAt: o.createdAt,
      }));

    const ready = activeOrders
      .filter((o) => o.status === "READY")
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((o) => ({
        token: o.token,
        orderId: o._id,
        items: o.items,
        updatedAt: o.updatedAt,
      }));

    res.status(200).json({
      status: "success",
      queued,
      preparing,
      ready,
      totalActiveOrders: activeOrders.length,
    });
  } catch (err) {
    next(err);
  }
};
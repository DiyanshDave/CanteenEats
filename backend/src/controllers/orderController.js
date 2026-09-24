import Order from "../models/Order.js";
import {
  getQueueInfo,
  isValidTransition,
} from "../services/queueService.js";

export const createOrder = async (req, res, next) => {
  res.status(410).json({
    status: "error",
    message: "Orders now require payment through /api/payments/create-order",
  });
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "name price category image isAvailable"
    );

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    const isOwner = order.user.toString() === req.user.id;
    const isStaffOrAdmin = ["STAFF", "ADMIN"].includes(req.user.role);

    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this order",
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

export const getOrderQueue = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).select(
      "_id user token status createdAt"
    );

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    const isOwner = order.user.toString() === req.user.id;
    const isStaffOrAdmin = ["STAFF", "ADMIN"].includes(req.user.role);

    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this order's queue information",
      });
    }

    const queueInfo = await getQueueInfo(order);

    res.status(200).json({
      status: "success",
      ...queueInfo,
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status: nextStatus } = req.body;

    const validStatuses = [
      "PLACED",
      "QUEUED",
      "PREPARING",
      "READY",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!nextStatus || !validStatuses.includes(nextStatus)) {
      return res.status(400).json({
        status: "error",
        message: "A valid status value is required",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        status: "error",
        message: "Order not found",
      });
    }

    if (!isValidTransition(order.status, nextStatus)) {
      return res.status(400).json({
        status: "error",
        message: `Cannot transition order from ${order.status} to ${nextStatus}`,
      });
    }

    const timestampByStatus = {
      QUEUED: "queuedAt",
      PREPARING: "preparingAt",
      READY: "readyAt",
      COMPLETED: "completedAt",
      CANCELLED: "cancelledAt",
    };
    const timestampField = timestampByStatus[nextStatus];

    if (timestampField && !order[timestampField]) {
      order[timestampField] = new Date();
    }

    order.status = nextStatus;
    await order.save();

    res.status(200).json({
      status: "success",
      order,
    });
  } catch (err) {
    next(err);
  }
};

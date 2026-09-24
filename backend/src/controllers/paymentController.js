import mongoose from "mongoose";
import Order from "../models/Order.js";
import { buildOrderItems } from "../services/orderService.js";
import { queuePaidOrder } from "../services/queueService.js";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../services/paymentService.js";

function checkoutDetails(order, keyId) {
  return {
    internalOrderId: order._id,
    razorpayOrderId: order.razorpayOrderId,
    amount: Math.round(order.totalAmount * 100),
    currency: "INR",
    keyId,
  };
}

export const createPaymentOrder = async (req, res, next) => {
  try {
    const { items, internalOrderId } = req.body;
    let order;

    if (internalOrderId) {
      if (!mongoose.Types.ObjectId.isValid(internalOrderId)) {
        return res.status(400).json({ status: "error", message: "Invalid order reference" });
      }
      order = await Order.findOne({ _id: internalOrderId, user: req.user.id });
      if (!order) return res.status(404).json({ status: "error", message: "Order not found" });
      if (order.paymentStatus === "PAID") {
        if (order.token) {
          return res.status(200).json({ status: "success", order });
        }
        return res.status(409).json({ status: "error", message: "This order has already been paid" });
      }
      if (order.status !== "PENDING_PAYMENT" || !Array.isArray(items)) {
        return res.status(400).json({ status: "error", message: "This order cannot be retried" });
      }
      if (items.some((item) => (
        !item ||
        !mongoose.Types.ObjectId.isValid(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ))) {
        return res.status(400).json({ status: "error", message: "Checkout items are invalid" });
      }
      const requested = items.map(({ productId, quantity }) => `${productId}:${quantity}`).sort();
      const stored = order.items.map(({ product, quantity }) => `${product}:${quantity}`).sort();
      if (requested.length !== stored.length || requested.some((item, index) => item !== stored[index])) {
        return res.status(409).json({ status: "error", message: "Your cart has changed. Start checkout again." });
      }
      if (order.razorpayOrderId) {
        order.paymentStatus = "PENDING";
        await order.save();
        return res.status(200).json({
          status: "success",
          checkout: checkoutDetails(order, getRazorpayKeyId()),
        });
      }
    } else {
      const { orderItems, totalAmount } = await buildOrderItems(items);
      order = await Order.create({
        user: req.user.id,
        items: orderItems,
        totalAmount,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        paymentMethod: "RAZORPAY",
      });
    }

    try {
      const { providerOrder, keyId } = await createRazorpayOrder({
        amount: Math.round(order.totalAmount * 100),
        receipt: order._id.toString(),
      });
      if (
        !providerOrder.id ||
        providerOrder.amount !== Math.round(order.totalAmount * 100) ||
        providerOrder.currency !== "INR"
      ) {
        throw new Error("Payment provider returned an unexpected order");
      }
      order.razorpayOrderId = providerOrder.id;
      order.paymentStatus = "PENDING";
      await order.save();
      return res.status(201).json({ status: "success", checkout: checkoutDetails(order, keyId) });
    } catch (paymentError) {
      // Return the internal reference so a retry reuses the same unpaid order.
      return res.status(paymentError.status || 502).json({
        status: "error",
        message: paymentError.message || "Payment service is temporarily unavailable",
        internalOrderId: order._id,
      });
    }
  } catch (err) {
    next(err);
  }
};

async function confirmCapturedPayment(order, payment, signature) {
  const expectedAmount = Math.round(order.totalAmount * 100);
  if (
    !payment.id ||
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== expectedAmount ||
    payment.currency !== "INR" ||
    payment.status !== "captured"
  ) {
    const error = new Error("Payment is not captured or does not match this order");
    error.status = 400;
    throw error;
  }

  if (order.paymentStatus === "PAID") {
    if (order.razorpayPaymentId !== payment.id) {
      const error = new Error("This order has already been paid");
      error.status = 409;
      throw error;
    }
  } else {
    if (order.status !== "PENDING_PAYMENT") {
      const error = new Error("This order is no longer awaiting payment");
      error.status = 409;
      throw error;
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, user: order.user, status: "PENDING_PAYMENT", paymentStatus: { $ne: "PAID" } },
      {
        $set: {
          paymentStatus: "PAID",
          razorpayPaymentId: payment.id,
          ...(signature ? { razorpaySignature: signature } : {}),
          paidAt: new Date(),
        },
      },
      { new: true }
    );
    if (updated) order = updated;
    else order = await Order.findById(order._id);
    if (order?.paymentStatus !== "PAID" || order.razorpayPaymentId !== payment.id) {
      const error = new Error("Payment confirmation could not be applied");
      error.status = 409;
      throw error;
    }
  }

  const queuedOrder = await queuePaidOrder(order._id);
  if (!queuedOrder) {
    const error = new Error("Payment was received, but order confirmation is still processing");
    error.status = 503;
    throw error;
  }
  return queuedOrder;
}

export const verifyPayment = async (req, res, next) => {
  try {
    const { internalOrderId, razorpay_payment_id: paymentId, razorpay_order_id: clientOrderId, razorpay_signature: signature } = req.body;
    if (!mongoose.Types.ObjectId.isValid(internalOrderId) || !paymentId || !clientOrderId || !signature) {
      return res.status(400).json({ status: "error", message: "Payment details are incomplete" });
    }
    const order = await Order.findOne({ _id: internalOrderId, user: req.user.id });
    if (!order) return res.status(404).json({ status: "error", message: "Order not found" });
    if (clientOrderId !== order.razorpayOrderId) {
      return res.status(400).json({ status: "error", message: "Payment does not match this order" });
    }
    if (!verifyPaymentSignature(order.razorpayOrderId, paymentId, signature)) {
      return res.status(400).json({ status: "error", message: "Payment verification failed" });
    }

    const payment = await fetchRazorpayPayment(paymentId);
    if (payment.id !== paymentId) {
      return res.status(400).json({ status: "error", message: "Payment verification failed" });
    }
    const confirmedOrder = await confirmCapturedPayment(order, payment, signature);
    const populatedOrder = await Order.findById(confirmedOrder._id).populate(
      "items.product",
      "name price category image isAvailable"
    );
    return res.status(200).json({ status: "success", order: populatedOrder });
  } catch (err) {
    next(err);
  }
};

export const razorpayWebhook = async (req, res) => {
  const signature = req.get("x-razorpay-signature");
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(400).json({ status: "error", message: "Invalid webhook signature" });
  }

  try {
    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id) return res.status(200).json({ status: "ignored" });

    const order = await Order.findOne({ razorpayOrderId: payment.order_id });
    if (!order) return res.status(200).json({ status: "ignored" });

    if (event === "payment.captured") {
      await confirmCapturedPayment(order, payment, undefined);
    } else if (event === "payment.failed" && order.paymentStatus !== "PAID") {
      await Order.updateOne(
        { _id: order._id, status: "PENDING_PAYMENT", paymentStatus: { $ne: "PAID" } },
        { $set: { paymentStatus: "FAILED" } }
      );
    }
    return res.status(200).json({ status: "ok" });
  } catch {
    return res.status(500).json({ status: "error", message: "Webhook processing failed" });
  }
};

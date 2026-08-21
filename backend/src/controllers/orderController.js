import crypto from "crypto";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

export const createOrder = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one order item is required",
      });
    }

    // Validate item shape and quantities
    for (const item of items) {
      if (!item.productId) {
        return res.status(400).json({
          status: "error",
          message: "Each item must include a productId",
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Each item quantity must be a positive integer",
        });
      }
    }

    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    const orderItems = [];
    let totalAmount = 0;

    for (const requestedItem of items) {
      const product = products.find(
        (p) => p._id.toString() === requestedItem.productId
      );

      if (!product) {
        return res.status(404).json({
          status: "error",
          message: `Product not found: ${requestedItem.productId}`,
        });
      }

      if (!product.isAvailable) {
        return res.status(400).json({
          status: "error",
          message: `Product is unavailable: ${product.name}`,
        });
      }

      const quantity = requestedItem.quantity;
      const priceSnapshot = product.price;

      orderItems.push({
        product: product._id,
        nameSnapshot: product.name,
        priceSnapshot,
        quantity,
      });

      totalAmount += priceSnapshot * quantity;
    }

    // Temporary unique token placeholder until queue token generation (Prompt #6)
    const temporaryToken = `TEMP-${crypto.randomUUID()}`;

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      totalAmount,
      token: temporaryToken,
      status: "PLACED",
      estimatedWaitMinutes: null,
    });

    res.status(201).json({
      status: "success",
      order,
    });
  } catch (err) {
    next(err);
  }
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
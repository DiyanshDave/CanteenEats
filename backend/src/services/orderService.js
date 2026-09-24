import mongoose from "mongoose";
import Product from "../models/Product.js";

export async function buildOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("At least one order item is required");
    error.status = 400;
    throw error;
  }

  for (const item of items) {
    if (!item || !mongoose.Types.ObjectId.isValid(item.productId)) {
      const error = new Error("Each item must include a valid productId");
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      const error = new Error("Each item quantity must be a positive integer");
      error.status = 400;
      throw error;
    }
  }

  const products = await Product.find({
    _id: { $in: items.map((item) => item.productId) },
  });
  const orderItems = [];
  let totalAmount = 0;

  for (const requestedItem of items) {
    const product = products.find(
      (candidate) => candidate._id.toString() === requestedItem.productId
    );
    if (!product) {
      const error = new Error(`Product not found: ${requestedItem.productId}`);
      error.status = 404;
      throw error;
    }
    if (!product.isAvailable) {
      const error = new Error(`Product is unavailable: ${product.name}`);
      error.status = 400;
      throw error;
    }

    orderItems.push({
      product: product._id,
      nameSnapshot: product.name,
      priceSnapshot: product.price,
      prepTimeMinutesSnapshot: product.prepTimeMinutes || 5,
      quantity: requestedItem.quantity,
    });
    totalAmount += product.price * requestedItem.quantity;
  }

  const amountPaise = Math.round((totalAmount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    const error = new Error("Order total is invalid");
    error.status = 400;
    throw error;
  }

  return { orderItems, amountPaise, totalAmount: amountPaise / 100 };
}

import mongoose from "mongoose";

// Embedded schema: preserves product name/price at the time of order
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    nameSnapshot: {
      type: String,
      required: true,
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    prepTimeMinutesSnapshot: {
      type: Number,
      min: 1,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    token: { type: String },
    tokenDate: Date,
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PLACED", "QUEUED", "PREPARING", "READY", "COMPLETED", "CANCELLED"],
      default: "PLACED",
    },
    paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"] },
    paymentMethod: { type: String, enum: ["RAZORPAY"] },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: Date,
    estimatedWaitMinutes: {
      type: Number,
      min: 0,
    },
    estimatedReadyAt: Date,
    queuedAt: Date,
    preparingAt: Date,
    readyAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    autoIndex: false,
    toJSON: {
      transform: (document, value) => {
        delete value.razorpaySignature;
        return value;
      },
    },
  }
);

orderSchema.index({ tokenDate: 1, token: 1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1, queuedAt: 1, createdAt: 1 });
orderSchema.index({ status: 1, readyAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;

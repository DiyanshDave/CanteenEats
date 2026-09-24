import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { razorpayWebhook } from "./controllers/paymentController.js";

const app = express();

// Core middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({
  verify: (req, res, buffer) => {
    if (req.path === "/api/payments/webhook") req.rawBody = Buffer.from(buffer);
  },
}));
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.post("/api/payments/webhook", razorpayWebhook);
app.use("/api/staff", staffRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Canteen Queue & Demand Management API is running",
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

// Centralized error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

export default app;

import express from "express";
import {
  createOrder,
  getOrderById,
  getOrderQueue,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticate, createOrder);
router.get("/:id", authenticate, getOrderById);
router.get("/:id/queue", authenticate, getOrderQueue);
router.patch("/:id/status", authenticate, authorize("STAFF", "ADMIN"), updateOrderStatus);

export default router;
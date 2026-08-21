import express from "express";
import {
  getStaffOrders,
  getStaffOrdersSummary,
  getStaffOrderById,
  getStaffQueue,
} from "../controllers/staffController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorize("STAFF", "ADMIN"));

router.get("/orders/summary", getStaffOrdersSummary);
router.get("/orders/:id", getStaffOrderById);
router.get("/orders", getStaffOrders);
router.get("/queue", getStaffQueue);

export default router;
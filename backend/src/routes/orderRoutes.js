import express from "express";
import { createOrder, getOrderById } from "../controllers/orderController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticate, createOrder);
router.get("/:id", authenticate, getOrderById);

export default router;
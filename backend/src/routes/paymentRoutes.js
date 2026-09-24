import express from "express";
import { createPaymentOrder, verifyPayment } from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create-order", authenticate, authorize("STUDENT"), createPaymentOrder);
router.post("/verify", authenticate, authorize("STUDENT"), verifyPayment);

export default router;

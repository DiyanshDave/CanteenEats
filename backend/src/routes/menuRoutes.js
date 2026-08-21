import express from "express";
import {
  getMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../controllers/menuController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getMenu);
router.get("/:id", getMenuItem);

router.post("/", authenticate, authorize("STAFF", "ADMIN"), createMenuItem);
router.patch("/:id", authenticate, authorize("STAFF", "ADMIN"), updateMenuItem);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteMenuItem);

export default router;
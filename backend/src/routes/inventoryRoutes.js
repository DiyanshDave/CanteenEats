import express from "express";
import {
  getInventory,
  getLowStockInventory,
  getInventorySummary,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventoryItem,
} from "../controllers/inventoryController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

// Specific routes must be registered before the /:id catch-all route
router.get("/summary", authorize("STAFF", "ADMIN"), getInventorySummary);
router.get("/low-stock", authorize("STAFF", "ADMIN"), getLowStockInventory);
router.get("/", authorize("STAFF", "ADMIN"), getInventory);
router.get("/:id", authorize("STAFF", "ADMIN"), getInventoryItem);

router.post("/", authorize("ADMIN"), createInventoryItem);
router.patch("/:id/adjust", authorize("STAFF", "ADMIN"), adjustInventoryItem);
router.patch("/:id", authorize("STAFF", "ADMIN"), updateInventoryItem);
router.delete("/:id", authorize("ADMIN"), deleteInventoryItem);

export default router;
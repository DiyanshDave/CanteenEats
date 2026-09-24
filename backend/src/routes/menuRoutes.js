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

router.get("/", (req, res, next) => {
  if (req.query.includeUnavailable !== "true") {
    return next();
  }

  return authenticate(req, res, () => authorize("ADMIN")(req, res, next));
}, getMenu);
router.get("/:id", getMenuItem);

router.post("/", authenticate, authorize("ADMIN"), createMenuItem);
router.patch("/:id", authenticate, authorize("ADMIN"), updateMenuItem);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteMenuItem);

export default router;

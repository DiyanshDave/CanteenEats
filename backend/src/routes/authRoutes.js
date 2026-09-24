import express from "express";
import {
  register,
  login,
  createDevelopmentUser,
} from "../controllers/authController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post(
  "/dev/create-user",
  (req, res, next) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({ status: "error", message: "Route not found" });
    }
    return next();
  },
  authenticate,
  authorize("ADMIN"),
  createDevelopmentUser
);

export default router;

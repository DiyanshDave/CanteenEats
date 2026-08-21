import express from "express";
import {
  getOverview,
  getPopularItems,
  getPeakHours,
  getDailyTrend,
  getCategoryPerformance,
  getDemandForecast,
} from "../controllers/analyticsController.js";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorize("STAFF", "ADMIN"));

router.get("/overview", getOverview);
router.get("/popular-items", getPopularItems);
router.get("/peak-hours", getPeakHours);
router.get("/daily-trend", getDailyTrend);
router.get("/category-performance", getCategoryPerformance);
router.get("/demand-forecast", getDemandForecast);

export default router;
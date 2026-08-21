import mongoose from "mongoose";
import Order from "../models/Order.js";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function parseDateRange(req) {
  const { date, startDate, endDate } = req.query;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return getTodayRange();
}

export const getOverview = async (req, res, next) => {
  try {
    const { start, end } = parseDateRange(req);
    const dateFilter = { createdAt: { $gte: start, $lte: end } };

    const [totalOrders, completedOrders, cancelledOrders, activeOrders, completedStats] =
      await Promise.all([
        Order.countDocuments(dateFilter),
        Order.countDocuments({ ...dateFilter, status: "COMPLETED" }),
        Order.countDocuments({ ...dateFilter, status: "CANCELLED" }),
        Order.countDocuments({
          ...dateFilter,
          status: { $in: ["QUEUED", "PREPARING", "READY"] },
        }),
        Order.aggregate([
          { $match: { ...dateFilter, status: "COMPLETED" } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$totalAmount" },
              count: { $sum: 1 },
              // Wait time proxy: time from createdAt to last update (COMPLETED), in minutes
              totalWaitMinutes: {
                $sum: {
                  $divide: [
                    { $subtract: ["$updatedAt", "$createdAt"] },
                    60000,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    const stats = completedStats[0] || { totalRevenue: 0, count: 0, totalWaitMinutes: 0 };

    const totalRevenue = stats.totalRevenue || 0;
    const averageOrderValue = stats.count > 0 ? totalRevenue / stats.count : 0;
    const averageWaitTime = stats.count > 0 ? stats.totalWaitMinutes / stats.count : 0;

    res.status(200).json({
      status: "success",
      overview: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        activeOrders,
        totalRevenue,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        averageWaitTime: Math.round(averageWaitTime * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPopularItems = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;

    const results = await Order.aggregate([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.nameSnapshot" },
          quantitySold: { $sum: "$items.quantity" },
          revenueGenerated: {
            $sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] },
          },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: 1,
          quantitySold: 1,
          revenueGenerated: 1,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      items: results,
    });
  } catch (err) {
    next(err);
  }
};

export const getPeakHours = async (req, res, next) => {
  try {
    const results = await Order.aggregate([
      { $match: { status: "COMPLETED" } },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: "$_id",
          orderCount: 1,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      peakHours: results,
    });
  } catch (err) {
    next(err);
  }
};

export const getDailyTrend = async (req, res, next) => {
  try {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const results = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orderCount: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
          },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalAmount", 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          orderCount: 1,
          completedOrders: 1,
          revenue: 1,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      dailyTrend: results,
    });
  } catch (err) {
    next(err);
  }
};

export const getCategoryPerformance = async (req, res, next) => {
  try {
    const results = await Order.aggregate([
      { $match: { status: "COMPLETED" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$productInfo.category", "Uncategorized"] },
          quantitySold: { $sum: "$items.quantity" },
          revenueGenerated: {
            $sum: { $multiply: ["$items.priceSnapshot", "$items.quantity"] },
          },
        },
      },
      { $sort: { quantitySold: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          quantitySold: 1,
          revenueGenerated: 1,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      categoryPerformance: results,
    });
  } catch (err) {
    next(err);
  }
};

export const getDemandForecast = async (req, res, next) => {
  try {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    // Daily quantity sold per product over the last 7 days
    const dailyQuantities = await Order.aggregate([
      { $match: { status: "COMPLETED", createdAt: { $gte: start, $lte: end } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            product: "$items.product",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          name: { $first: "$items.nameSnapshot" },
          dailyQuantity: { $sum: "$items.quantity" },
        },
      },
      {
        $group: {
          _id: "$_id.product",
          name: { $first: "$name" },
          daysWithData: { $sum: 1 },
          totalQuantity: { $sum: "$dailyQuantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    // Rolling average = total quantity over the window / number of days with data
    // (falls back gracefully when fewer than 7 days of history exist)
    const forecast = dailyQuantities.map((entry) => {
      const recentAverageDailyQuantity = entry.totalQuantity / entry.daysWithData;
      return {
        productId: entry._id,
        name: entry.name,
        recentAverageDailyQuantity: Math.round(recentAverageDailyQuantity * 100) / 100,
        forecastQuantity: Math.round(recentAverageDailyQuantity),
      };
    });

    res.status(200).json({
      status: "success",
      forecast,
    });
  } catch (err) {
    next(err);
  }
};
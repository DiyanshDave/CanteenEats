import InventoryItem from "../models/InventoryItem.js";

const toDashboardItem = (item) => ({
  id: item._id,
  name: item.name,
  unit: item.unit,
  quantity: item.quantity,
  lowStockThreshold: item.lowStockThreshold,
  isLowStock: item.quantity <= item.lowStockThreshold,
});

export const getInventory = async (req, res, next) => {
  try {
    const items = await InventoryItem.find();

    const mapped = items.map(toDashboardItem);

    // Low-stock items first, then normal-stock items
    mapped.sort((a, b) => {
      if (a.isLowStock === b.isLowStock) return 0;
      return a.isLowStock ? -1 : 1;
    });

    res.status(200).json({
      status: "success",
      count: mapped.length,
      items: mapped,
    });
  } catch (err) {
    next(err);
  }
};

export const getLowStockInventory = async (req, res, next) => {
  try {
    const items = await InventoryItem.find({
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    });

    res.status(200).json({
      status: "success",
      count: items.length,
      items: items.map(toDashboardItem),
    });
  } catch (err) {
    next(err);
  }
};

export const getInventorySummary = async (req, res, next) => {
  try {
    const [totalInventoryRecords, lowStockItems, outOfStockItems] = await Promise.all([
      InventoryItem.countDocuments(),
      InventoryItem.countDocuments({
        $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
        quantity: { $gt: 0 },
      }),
      InventoryItem.countDocuments({ quantity: 0 }),
    ]);

    res.status(200).json({
      status: "success",
      summary: {
        totalItems: totalInventoryRecords,
        lowStockItems,
        outOfStockItems,
        totalInventoryRecords,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      status: "success",
      item: toDashboardItem(item),
    });
  } catch (err) {
    next(err);
  }
};

export const createInventoryItem = async (req, res, next) => {
  try {
    const { name, unit, quantity, lowStockThreshold } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Name is required",
      });
    }

    if (!unit || !unit.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Unit is required",
      });
    }

    if (typeof quantity !== "number" || quantity < 0) {
      return res.status(400).json({
        status: "error",
        message: "Quantity must be a number >= 0",
      });
    }

    if (typeof lowStockThreshold !== "number" || lowStockThreshold < 0) {
      return res.status(400).json({
        status: "error",
        message: "lowStockThreshold must be a number >= 0",
      });
    }

    const item = await InventoryItem.create({
      name,
      unit,
      quantity,
      lowStockThreshold,
    });

    res.status(201).json({
      status: "success",
      item: toDashboardItem(item),
    });
  } catch (err) {
    next(err);
  }
};

export const updateInventoryItem = async (req, res, next) => {
  try {
    const { name, unit, quantity, lowStockThreshold } = req.body;

    if (quantity !== undefined && (typeof quantity !== "number" || quantity < 0)) {
      return res.status(400).json({
        status: "error",
        message: "Quantity cannot be negative",
      });
    }

    if (
      lowStockThreshold !== undefined &&
      (typeof lowStockThreshold !== "number" || lowStockThreshold < 0)
    ) {
      return res.status(400).json({
        status: "error",
        message: "lowStockThreshold cannot be negative",
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (unit !== undefined) updates.unit = unit;
    if (quantity !== undefined) updates.quantity = quantity;
    if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold;

    const item = await InventoryItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      status: "success",
      item: toDashboardItem(item),
    });
  } catch (err) {
    next(err);
  }
};

export const deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Inventory item deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const adjustInventoryItem = async (req, res, next) => {
  try {
    const { change } = req.body;

    if (typeof change !== "number" || change === 0 || Number.isNaN(change)) {
      return res.status(400).json({
        status: "error",
        message: "change must be a non-zero number",
      });
    }

    const item = await InventoryItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Inventory item not found",
      });
    }

    const newQuantity = item.quantity + change;

    if (newQuantity < 0) {
      return res.status(400).json({
        status: "error",
        message: "Adjustment would result in negative quantity",
      });
    }

    item.quantity = newQuantity;
    await item.save();

    res.status(200).json({
      status: "success",
      item: toDashboardItem(item),
    });
  } catch (err) {
    next(err);
  }
};
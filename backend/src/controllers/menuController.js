import Product from "../models/Product.js";

export const getMenu = async (req, res, next) => {
  try {
    const { category } = req.query;

    const canIncludeUnavailable =
      req.query.includeUnavailable === "true" && req.user?.role === "ADMIN";
    const filter = canIncludeUnavailable ? {} : { isAvailable: true };
    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter).sort({ category: 1, name: 1 });

    res.status(200).json({
      status: "success",
      count: products.length,
      products,
    });
  } catch (err) {
    next(err);
  }
};

export const getMenuItem = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.status(200).json({
      status: "success",
      product,
    });
  } catch (err) {
    next(err);
  }
};

export const createMenuItem = async (req, res, next) => {
  try {
    const { name, description, price, category, image, isAvailable } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        status: "error",
        message: "Name and price are required",
      });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Price must be a positive number",
      });
    }

    const product = await Product.create({
      name,
      description,
      price,
      category,
      image,
      isAvailable: isAvailable === undefined ? true : isAvailable,
    });

    res.status(201).json({
      status: "success",
      product,
    });
  } catch (err) {
    next(err);
  }
};

export const updateMenuItem = async (req, res, next) => {
  try {
    const { name, description, price, category, image, isAvailable } = req.body;

    if (price !== undefined && (typeof price !== "number" || price <= 0)) {
      return res.status(400).json({
        status: "error",
        message: "Price must be a positive number",
      });
    }

    if (isAvailable !== undefined && typeof isAvailable !== "boolean") {
      return res.status(400).json({
        status: "error",
        message: "isAvailable must be a boolean",
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (category !== undefined) updates.category = category;
    if (image !== undefined) updates.image = image;
    if (isAvailable !== undefined) updates.isAvailable = isAvailable;

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.status(200).json({
      status: "success",
      product,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteMenuItem = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Product deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

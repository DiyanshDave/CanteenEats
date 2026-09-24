import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Strip password before sending user data back
const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "Email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      // Public registration must never grant privileged roles.
      role: "STUDENT",
    });

    const token = generateToken(user);

    res.status(201).json({
      status: "success",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      status: "success",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const createDevelopmentUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password ||
      !["STAFF", "ADMIN"].includes(role)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, password, and a STAFF or ADMIN role are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "Email is already registered",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role,
    });

    return res.status(201).json({
      status: "success",
      user: sanitizeUser(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: "Email is already registered",
      });
    }
    return next(err);
  }
};

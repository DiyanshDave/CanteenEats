import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import Order from "./models/Order.js";

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

for (const variable of ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"]) {
  if (!process.env[variable]) {
    console.error(`Missing required environment variable: ${variable}`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters long");
  process.exit(1);
}

// Connect to MongoDB, then start the server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    return ensureOrderIndexes();
  })
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

async function ensureOrderIndexes() {
  let indexes = [];
  try {
    indexes = await Order.collection.indexes();
  } catch (err) {
    if (err.code !== 26) throw err;
  }

  const legacyTokenIndex = indexes.find((index) => (
    index.key?.token === 1 && Object.keys(index.key).length === 1
  ));
  if (legacyTokenIndex) {
    await Order.collection.dropIndex(legacyTokenIndex.name);
  }
  await Order.collection.updateMany(
    { token: { $type: "string" }, tokenDate: { $exists: false } },
    [{
      $set: {
        tokenDate: {
          $dateFromParts: {
            year: { $year: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            month: { $month: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            day: { $dayOfMonth: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            timezone: "Asia/Kolkata",
          },
        },
      },
    }]
  );
  await Order.collection.createIndex({ tokenDate: 1, token: 1 }, { unique: true, sparse: true });
  await Order.collection.createIndex({ status: 1, queuedAt: 1, createdAt: 1 });
  await Order.collection.createIndex({ status: 1, readyAt: -1 });
}

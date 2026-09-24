import "dotenv/config";
import mongoose from "mongoose";
import Product from "../src/models/Product.js";
import demoMenu from "../src/data/demoMenu.js";

if (process.env.NODE_ENV !== "development") {
  console.error("Demo menu seeding is only available when NODE_ENV=development.");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error("Missing required environment variable: MONGODB_URI");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await Product.find({}, { name: 1 }).lean();
  const existingNames = new Set(existing.map(({ name }) => name.trim().toLocaleLowerCase()));
  const additions = demoMenu.filter(({ name }) => !existingNames.has(name.toLocaleLowerCase()));
  const skipped = demoMenu.length - additions.length;

  if (additions.length) {
    await Product.insertMany(additions.map((product) => ({ ...product, isAvailable: true })));
  }

  console.log(`Demo menu complete: added ${additions.length} products; skipped ${skipped} existing products.`);
} catch (error) {
  console.error("Demo menu seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

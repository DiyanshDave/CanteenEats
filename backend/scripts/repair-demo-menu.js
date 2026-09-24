import "dotenv/config";
import mongoose from "mongoose";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";

const IMAGE_PATHS = {
  paneerChilli: "/menu-images/paneer-chilli.jpg",
  idliSambar: "/menu-images/idli-sambar.jpg",
  masalaDosa: "/menu-images/masala-dosa.jpg",
  vegBiryani: "/menu-images/veg-biryani.jpg",
};
const apply = process.argv.includes("--apply");

if (process.env.NODE_ENV !== "development") {
  console.error("Demo menu repair is only available when NODE_ENV=development.");
  process.exit(1);
}

if (!apply) {
  console.error("No changes made. Re-run with --apply to repair the development menu.");
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error("Missing required environment variable: MONGODB_URI");
  process.exit(1);
}

const namePattern = (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
const normalize = (name) => name.trim().toLocaleLowerCase();

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const session = await mongoose.startSession();
  const changes = [];

  try {
    await session.withTransaction(async () => {
      const names = ["Paneer Chilli", "Idli Sambar", "Masala Dosa", "Chicken Biryani", "Veg Biryani"];
      const records = await Product.find(
        { $or: names.map((name) => ({ name: namePattern(name) })) },
        { name: 1, description: 1, category: 1, image: 1, price: 1, isAvailable: 1 }
      ).session(session);
      const grouped = new Map();
      for (const product of records) {
        const key = normalize(product.name);
        grouped.set(key, [...(grouped.get(key) || []), product]);
      }

      const single = (name, required = true) => {
        const matches = grouped.get(normalize(name)) || [];
        if (matches.length > 1 || (required && matches.length !== 1)) {
          throw new Error(`Expected exactly one ${name} record; found ${matches.length}. No repair was committed.`);
        }
        return matches[0] || null;
      };

      const paneerChilli = single("Paneer Chilli");
      const idliSambar = single("Idli Sambar");
      const masalaDosa = single("Masala Dosa");
      const chickenBiryani = single("Chicken Biryani", false);
      const vegBiryani = single("Veg Biryani", false);

      if (!chickenBiryani && !vegBiryani) {
        throw new Error("No Chicken Biryani or Veg Biryani record exists. No repair was committed.");
      }

      let biryani = vegBiryani || chickenBiryani;
      if (chickenBiryani && vegBiryani) {
        const references = await Order.countDocuments({ "items.product": chickenBiryani._id }).session(session);
        if (references > 0) {
          throw new Error("Both biryani records exist and the legacy record is referenced by orders. No repair was committed; manual reconciliation is required to preserve order history.");
        }
        await Product.deleteOne({ _id: chickenBiryani._id }).session(session);
        changes.push({ id: String(chickenBiryani._id), action: "removed duplicate Chicken Biryani product with no order references" });
      }

      const updates = [
        [paneerChilli, { image: IMAGE_PATHS.paneerChilli }],
        [idliSambar, { image: IMAGE_PATHS.idliSambar }],
        [masalaDosa, { image: IMAGE_PATHS.masalaDosa }],
        [biryani, {
          name: "Veg Biryani",
          description: "Fragrant basmati rice layered with spiced vegetables and herbs.",
          category: "Main Course",
          image: IMAGE_PATHS.vegBiryani,
        }],
      ];

      for (const [product, fields] of updates) {
        const changedFields = Object.entries(fields).filter(([key, value]) => product[key] !== value);
        if (!changedFields.length) continue;
        const $set = Object.fromEntries(changedFields);
        await Product.updateOne({ _id: product._id }, { $set }, { session, runValidators: true });
        changes.push({ id: String(product._id), name: fields.name || product.name, fields: changedFields.map(([key]) => key) });
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(JSON.stringify({ status: "repaired", changes }, null, 2));
} catch (error) {
  console.error("Demo menu repair failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

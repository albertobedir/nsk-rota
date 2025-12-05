import mongoose, { Mongoose } from "mongoose";
import Product from "@/schemas/mongoose/product"; // Mongoose model

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  throw new Error("❌ MONGO_URL environment variable missing!");
}

interface GlobalMongoose {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

const globalForMongoose = globalThis as unknown as {
  mongoose?: GlobalMongoose;
};

const cached = globalForMongoose.mongoose ?? {
  conn: null,
  promise: null,
};

globalForMongoose.mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URL as string, {
      dbName: "b2b_shop",
    });
  }

  cached.conn = await cached.promise;

  try {
    await Product.collection.createIndex({
      "raw.metafields.key": 1,
      "raw.metafields.value": 1,
      shopifyId: 1,
    });
    console.log("✅ Product collection indexes created!");
  } catch (err) {
    console.error("❌ Failed to create indexes:", err);
  }

  return cached.conn;
}

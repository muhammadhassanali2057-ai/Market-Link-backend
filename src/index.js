import app from "./app.js";
import connectDB from "./config/db.js";
import mongoose from "mongoose";

let dbPromise = null;

async function handler(req, res) {
  try {
    console.log("=== MONGODB DEBUG ===");
    console.log("MONGODB_URI exists:", Boolean(process.env.MONGODB_URI));
    console.log("Mongoose state BEFORE:", mongoose.connection.readyState);

    if (!dbPromise) {
      dbPromise = connectDB();
    }

    await dbPromise;

    console.log("Mongoose state AFTER:", mongoose.connection.readyState);

    return app(req, res);
  } catch (error) {
    console.error("=== MONGODB ERROR ===");
    console.error(error);

    dbPromise = null;

    return res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
}

export default handler;

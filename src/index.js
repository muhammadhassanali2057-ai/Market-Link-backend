import app from "../app.js";
import connectDB from "../config/db.js";

let dbPromise;

async function handler(req, res) {
  try {
    console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);

    if (!dbPromise) {
      dbPromise = connectDB();
    }

    await dbPromise;

    console.log("MongoDB connection ready");

    return app(req, res);
  } catch (error) {
    console.error("DATABASE ERROR:", error);
    return res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
}

export default handler;

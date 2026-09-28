import app from "../app.js";
import connectDB from "../config/db.js";

let dbPromise;

async function handler(req, res) {
  try {
    if (!dbPromise) {
      dbPromise = connectDB();
    }

    await dbPromise;

    return app(req, res);
  } catch (error) {
    console.error("Database initialization failed:", error);
    return res.status(500).json({
      message: "Database connection failed",
    });
  }
}

export default handler;

import app from "../app.js";
import connectDB from "../config/db.js";

let dbPromise = null;

async function handler(req, res) {
  try {
    if (!dbPromise) {
      dbPromise = connectDB();
    }

    await dbPromise;

    return app(req, res);
  } catch (error) {
    console.error("DATABASE ERROR:", error);

    dbPromise = null;

    return res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
}

export default handler;

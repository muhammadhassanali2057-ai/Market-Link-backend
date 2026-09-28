import app from "../app.js";
import connectDB from "../config/db.js";

let dbPromise = null;

async function handler(req, res) {
  try {
    console.log("=== DATABASE DEBUG ===");
    console.log("MONGODB_URI exists:", Boolean(process.env.MONGODB_URI));

    if (!dbPromise) {
      dbPromise = connectDB();
    }

    await dbPromise;

    console.log("MongoDB connection READY");

    return app(req, res);
  } catch (error) {
    console.error("=== DATABASE CONNECTION ERROR ===");
    console.error(error);
    
    return res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
}

export default handler;

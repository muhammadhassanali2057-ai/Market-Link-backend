import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`
    );

    return conn.connection;
  } catch (err) {
    console.error("MONGODB CONNECTION ERROR:", err);
    throw err;
  }
}

export default connectDB;

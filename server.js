import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dataRoutes from "./routes/dataRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — Allow all for now (Vercel + local)
app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

// MongoDB Connection
async function connectDb() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

// Connect DB
connectDb();

// Routes
app.use("/api/data", dataRoutes);

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is listening on port ${PORT}`);
});

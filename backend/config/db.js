import mongoose from "mongoose";
import dns from "dns";

// Support mongodb+srv on Windows environments where default DNS drops SRV lookups
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch {
  // Ignore if restricted
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    console.error("Make sure MongoDB is running and MONGODB_URI in backend/.env is correct.");
    process.exit(1);
  }
};

export default connectDB;

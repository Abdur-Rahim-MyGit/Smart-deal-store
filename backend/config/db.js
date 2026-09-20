import mongoose from "mongoose";

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

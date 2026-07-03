const mongoose = require('mongoose');

const globalMongoose = global;
if (!globalMongoose.__mongooseCache) {
  globalMongoose.__mongooseCache = { conn: null, promise: null };
}

const connectDB = async () => {
  if (globalMongoose.__mongooseCache.conn) {
    return globalMongoose.__mongooseCache.conn;
  }

  if (mongoose.connection.readyState === 1) {
    globalMongoose.__mongooseCache.conn = mongoose.connection;
    return mongoose.connection;
  }

  if (globalMongoose.__mongooseCache.promise) {
    return globalMongoose.__mongooseCache.promise;
  }

  try {
    globalMongoose.__mongooseCache.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 20000,
        maxPoolSize: 10,
        minPoolSize: 1,
      })
      .then((conn) => {
        globalMongoose.__mongooseCache.conn = conn.connection;
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn.connection;
      });

    return await globalMongoose.__mongooseCache.promise;
  } catch (error) {
    globalMongoose.__mongooseCache.promise = null;
    throw new Error(`MongoDB connection error: ${error.message}`);
  }
};

module.exports = connectDB;

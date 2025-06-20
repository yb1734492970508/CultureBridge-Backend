// 数据库连接配置
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const connectDB = async () => {
  try {
    // 使用提供的MongoDB Atlas连接字符串
    const mongoUri = process.env.MONGO_URI || 
                     process.env.MONGODB_URI || 
                     'mongodb+srv://Culturebridge:Yibin199058@culturebridge.qrfsxrk.mongodb.net/?retryWrites=true&w=majority&appName=Culturebridge';
    
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;


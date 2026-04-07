require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB Connection...');
console.log('📍 Looking for .env file at: ../env');
console.log('🔍 MONGODB_URI found:', !!process.env.MONGODB_URI);
console.log('📝 MONGODB_URI preview:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 50) + '...' : 'NOT FOUND');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  console.error('💡 Make sure .env file exists in backend/ directory');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB!');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🏠 Host:', mongoose.connection.host);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ FAILED:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  });

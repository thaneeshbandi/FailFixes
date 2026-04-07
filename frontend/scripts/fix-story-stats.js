const mongoose = require('mongoose');
const Story = require('../models/Story');
require('dotenv').config();

async function fixStoryStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/failfixes');
    console.log('Connected to MongoDB');

    // Add stats field to all stories that don't have it
    const result1 = await Story.updateMany(
      { stats: { $exists: false } },
      { 
        $set: { 
          stats: {
            views: 0,
            likes: 0,
            comments: 0
          }
        } 
      }
    );

    // Fix stories that have stats but missing views field
    const result2 = await Story.updateMany(
      { 'stats.views': { $exists: false } },
      { 
        $set: { 
          'stats.views': 0,
          'stats.likes': 0,
          'stats.comments': 0
        } 
      }
    );

    console.log(`✅ Fixed ${result1.modifiedCount + result2.modifiedCount} stories`);
    console.log('Migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixStoryStats();

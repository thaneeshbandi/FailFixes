require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';

async function testPerformance() {
  console.log('🚀 FailFixes Performance Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const endpoint = `${API_URL}/api/stories`;

  // Clear cache
  try {
    await axios.delete(`${API_URL}/api/cache/clear`);
    console.log('🗑️  Cache cleared\n');
  } catch (err) {
    console.log('ℹ️  Testing without cache clear\n');
  }

  // Test 1: Database Query
  console.log('📊 Test 1: Database Query (No Cache)');
  const test1Start = Date.now();
  const response1 = await axios.get(endpoint);
  const test1Time = Date.now() - test1Start;
  
  console.log(`   Time: ${test1Time}ms`);
  console.log(`   Status: ${response1.headers['x-cache-status'] || 'N/A'}`);
  console.log(`   Stories: ${response1.data.data?.length || 0}\n`);

  await new Promise(resolve => setTimeout(resolve, 100));

  // Test 2: Cache Query
  console.log('⚡ Test 2: Redis Cache Query');
  const test2Start = Date.now();
  const response2 = await axios.get(endpoint);
  const test2Time = Date.now() - test2Start;
  
  console.log(`   Time: ${test2Time}ms`);
  console.log(`   Status: ${response2.headers['x-cache-status'] || 'N/A'}`);
  console.log(`   Stories: ${response2.data.data?.length || 0}\n`);

  // Results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 RESULTS\n');
  
  const improvement = ((test1Time - test2Time) / test1Time * 100).toFixed(2);
  const speedup = (test1Time / test2Time).toFixed(2);
  
  console.log(`Database:    ${test1Time}ms`);
  console.log(`Cache:       ${test2Time}ms`);
  console.log(`Saved:       ${test1Time - test2Time}ms`);
  console.log(`Improvement: ${improvement}%`);
  console.log(`Speedup:     ${speedup}x faster`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test Complete!\n');
}

testPerformance().catch(console.error);

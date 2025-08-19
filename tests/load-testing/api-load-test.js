import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Stay at 100 users for 10 minutes
    { duration: '5m', target: 200 },  // Ramp up to 200 users
    { duration: '10m', target: 200 }, // Stay at 200 users for 10 minutes
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be below 1%
    errors: ['rate<0.01'],            // Custom error rate below 1%
    api_response_time: ['p(95)<100'], // API response time target
  },
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://your-api-domain.execute-api.us-west-2.amazonaws.com/prod';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'your-test-auth-token';

// Test data
const testData = {
  chatMessages: [
    'Bula! How do you say hello in Fijian?',
    'What is the weather like today?',
    'Can you teach me basic Fijian greetings?',
    'How do you say goodbye in Fijian?',
    'What are common Fijian phrases for travelers?',
  ],
  dictionaryQueries: [
    'bula',
    'vinaka',
    'moce',
    'io',
    'sega',
  ],
  ragQueries: [
    'Tell me about Fijian culture',
    'What are traditional Fijian foods?',
    'How do I greet someone in Fijian?',
    'What is the history of Fiji?',
    'Explain Fijian language basics',
  ],
};

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function createHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
}

// Test scenarios
export default function () {
  group('Authentication Test', () => {
    // Test without authentication (should fail)
    const noAuthResponse = http.get(`${BASE_URL}/learn`);
    check(noAuthResponse, {
      'no auth returns 401': (r) => r.status === 401,
    });
  });

  group('Chat API Load Test', () => {
    const chatPayload = {
      message: getRandomElement(testData.chatMessages),
      timestamp: Date.now(),
    };

    const chatResponse = http.post(
      `${BASE_URL}/chat`,
      JSON.stringify(chatPayload),
      { headers: createHeaders() }
    );

    const success = check(chatResponse, {
      'chat status is 200': (r) => r.status === 200,
      'chat response time < 2s': (r) => r.timings.duration < 2000,
      'chat has response body': (r) => r.body && r.body.length > 0,
    });

    errorRate.add(!success);
    apiResponseTime.add(chatResponse.timings.duration);

    if (!success) {
      console.error(`Chat API failed: ${chatResponse.status} - ${chatResponse.body}`);
    }
  });

  group('Dictionary API Load Test', () => {
    const word = getRandomElement(testData.dictionaryQueries);
    
    const dictResponse = http.get(
      `${BASE_URL}/dictionary/lookup?word=${word}`,
      { headers: createHeaders() }
    );

    const success = check(dictResponse, {
      'dictionary status is 200': (r) => r.status === 200,
      'dictionary response time < 500ms': (r) => r.timings.duration < 500,
      'dictionary has results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && (body.results || body.entries);
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
    apiResponseTime.add(dictResponse.timings.duration);
  });

  group('RAG API Load Test', () => {
    const ragPayload = {
      query: getRandomElement(testData.ragQueries),
      context: 'learning',
      timestamp: Date.now(),
    };

    const ragResponse = http.post(
      `${BASE_URL}/rag/query`,
      JSON.stringify(ragPayload),
      { headers: createHeaders() }
    );

    const success = check(ragResponse, {
      'rag status is 200': (r) => r.status === 200,
      'rag response time < 3s': (r) => r.timings.duration < 3000,
      'rag has answer': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && body.answer;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
    apiResponseTime.add(ragResponse.timings.duration);
  });

  group('Learning Modules API Load Test', () => {
    const moduleId = 'lesson-1-greetings';
    
    const moduleResponse = http.get(
      `${BASE_URL}/learning-modules/${moduleId}`,
      { headers: createHeaders() }
    );

    check(moduleResponse, {
      'module status is 200': (r) => r.status === 200,
      'module response time < 1s': (r) => r.timings.duration < 1000,
      'module has content': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && body.content;
        } catch (e) {
          return false;
        }
      },
    });
  });

  // Random sleep between requests to simulate real user behavior
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// Setup function runs once before the test
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  console.log('Test configuration:');
  console.log('- Max users: 200');
  console.log('- Duration: ~37 minutes');
  console.log('- Target p95 response time: 500ms');
  console.log('- Target error rate: <1%');
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/learn`, { headers: createHeaders() });
  if (healthCheck.status !== 200) {
    console.warn(`Warning: Health check failed with status ${healthCheck.status}`);
  }
  
  return { startTime: Date.now() };
}

// Teardown function runs once after the test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
}

// Handle test summary
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.txt': `
Load Test Summary
=================
Duration: ${data.metrics.iteration_duration.values.avg}ms average iteration
Total Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
95th Percentile Response Time: ${data.metrics.http_req_duration.values['p(95)']}ms
99th Percentile Response Time: ${data.metrics.http_req_duration.values['p(99)']}ms

Thresholds:
- p95 response time: ${data.metrics.http_req_duration.values['p(95)'] < 500 ? 'PASS' : 'FAIL'}
- Error rate: ${data.metrics.http_req_failed.values.rate < 0.01 ? 'PASS' : 'FAIL'}
    `,
  };
}
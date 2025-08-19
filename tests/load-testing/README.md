# Load Testing Guide

This guide covers load testing procedures for the Fijian RAG App to validate performance targets and scalability.

## Prerequisites

### Required Tools
- **k6**: Load testing tool
  ```bash
  # Install k6
  curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
  ```

- **AWS CLI**: For monitoring during tests
- **jq**: For processing JSON results

### Environment Setup

```bash
# Set environment variables
export BASE_URL="https://your-api-domain.execute-api.us-west-2.amazonaws.com/prod"
export AUTH_TOKEN="your-test-auth-token"
export AWS_REGION="us-west-2"
```

## Load Testing Scenarios

### 1. API Load Test

**File**: `tests/load-testing/api-load-test.js`

**Test Profile**:
- **Ramp-up**: 2 minutes to 10 users
- **Load**: 5 minutes at 50 users
- **Peak**: 10 minutes at 100 users
- **Stress**: 5 minutes at 200 users
- **Sustained**: 10 minutes at 200 users
- **Ramp-down**: 5 minutes to 0 users

**Performance Targets**:
- p95 response time < 500ms
- Error rate < 1%
- API-specific targets < 100ms (p50)

**Run Test**:
```bash
cd tests/load-testing
k6 run api-load-test.js
```

### 2. Frontend Performance Test

Create a separate test for frontend performance:

```bash
# Frontend load test (example with artillery)
npm install -g artillery

# Create artillery config
cat > frontend-load-test.yml << EOF
config:
  target: 'https://your-cloudfront-domain.cloudfront.net'
  phases:
    - duration: 300
      arrivalRate: 10
    - duration: 600
      arrivalRate: 50
    - duration: 300
      arrivalRate: 100
  defaults:
    headers:
      User-Agent: 'Artillery Load Test'

scenarios:
  - name: 'Page Load Test'
    flow:
      - get:
          url: '/'
      - think: 2
      - get:
          url: '/static/js/main.js'
      - get:
          url: '/static/css/main.css'
EOF

artillery run frontend-load-test.yml
```

## Performance Monitoring During Tests

### CloudWatch Metrics

Monitor these metrics during load tests:

```bash
# API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=fijian-ai-api \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda function metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=FijianApiLambda \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=DictionaryTable \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Real-time Monitoring

```bash
# Watch CloudWatch logs during test
aws logs tail /aws/lambda/FijianApiLambda --follow &

# Monitor API Gateway access logs
aws logs tail API-Gateway-Execution-Logs --follow &

# Watch system metrics
watch -n 5 'aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=fijian-ai-api \
  --start-time $(date -d "5 minutes ago" -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average | jq ".Datapoints[].Average"'
```

## Test Execution Procedures

### Pre-Test Checklist

- [ ] Verify production environment is stable
- [ ] Confirm monitoring systems are operational
- [ ] Notify team of upcoming load test
- [ ] Backup current performance baseline
- [ ] Ensure test authentication tokens are valid

### Test Execution

1. **Baseline Measurement**:
   ```bash
   # Capture baseline metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name Latency \
     --dimensions Name=ApiName,Value=fijian-ai-api \
     --start-time $(date -d "1 hour ago" -u +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 3600 \
     --statistics Average > baseline-metrics.json
   ```

2. **Execute Load Test**:
   ```bash
   # Run API load test
   k6 run --out json=results.json api-load-test.js
   ```

3. **Monitor During Test**:
   - Watch CloudWatch dashboards
   - Monitor error rates and response times
   - Check for any alarms triggered
   - Observe system resource utilization

4. **Post-Test Analysis**:
   ```bash
   # Generate performance report
   k6 run --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" api-load-test.js
   ```

### Performance Benchmarks

#### API Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Time (p50) | < 100ms | API Gateway latency |
| Response Time (p95) | < 500ms | API Gateway latency |
| Response Time (p99) | < 1000ms | API Gateway latency |
| Error Rate | < 1% | 4xx/5xx responses |
| Throughput | 1000+ req/min | Sustained load |
| Concurrent Users | 200+ | Active connections |

#### Frontend Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Web Vitals |
| Largest Contentful Paint | < 2.5s | Web Vitals |
| Time to Interactive | < 3.0s | Web Vitals |
| Cumulative Layout Shift | < 0.1 | Web Vitals |
| First Input Delay | < 100ms | Web Vitals |

#### Infrastructure Targets

| Component | Metric | Target |
|-----------|--------|--------|
| Lambda | Duration | < 5000ms |
| Lambda | Memory Usage | < 80% |
| DynamoDB | Read Throttling | 0 |
| DynamoDB | Write Throttling | 0 |
| CloudFront | Cache Hit Rate | > 85% |

## Load Test Scenarios

### 1. Normal Load Test
- **Users**: 50 concurrent
- **Duration**: 30 minutes
- **Purpose**: Validate normal operation

### 2. Peak Load Test
- **Users**: 200 concurrent
- **Duration**: 15 minutes
- **Purpose**: Test peak capacity

### 3. Stress Test
- **Users**: 500 concurrent
- **Duration**: 10 minutes
- **Purpose**: Find breaking point

### 4. Spike Test
- **Pattern**: 10 → 200 → 10 users in 5 minutes
- **Purpose**: Test auto-scaling response

### 5. Endurance Test
- **Users**: 100 concurrent
- **Duration**: 2 hours
- **Purpose**: Test for memory leaks

## Results Analysis

### Performance Report Template

```bash
# Generate comprehensive report
cat > performance-report.sh << 'EOF'
#!/bin/bash

echo "=== Performance Test Report ==="
echo "Date: $(date)"
echo "Environment: Production"
echo ""

echo "=== Test Results ==="
if [ -f "results.json" ]; then
  jq '.metrics.http_req_duration.values' results.json
  echo ""
  echo "Error Rate: $(jq '.metrics.http_req_failed.values.rate' results.json)"
  echo "Total Requests: $(jq '.metrics.http_reqs.values.count' results.json)"
fi

echo ""
echo "=== CloudWatch Metrics ==="
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=fijian-ai-api \
  --start-time $(date -d "1 hour ago" -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum | jq '.Datapoints'

echo ""
echo "=== Recommendations ==="
# Add analysis logic here
EOF

chmod +x performance-report.sh
./performance-report.sh > performance-report-$(date +%Y%m%d-%H%M).txt
```

### Key Performance Indicators (KPIs)

Track these KPIs across tests:

- **Response Time Trend**: p95 response times over time
- **Error Rate Trend**: Error percentage over time
- **Throughput Capacity**: Maximum sustained requests per minute
- **Scalability Factor**: Performance degradation with increased load
- **Recovery Time**: Time to return to baseline after load

### Test Data Management

```bash
# Archive test results
mkdir -p test-results/$(date +%Y%m%d)
mv results.json test-results/$(date +%Y%m%d)/
mv load-test-*.txt test-results/$(date +%Y%m%d)/
mv performance-report-*.txt test-results/$(date +%Y%m%d)/

# Create summary dashboard
cat > test-results/$(date +%Y%m%d)/summary.md << EOF
# Load Test Summary - $(date +%Y-%m-%d)

## Test Configuration
- Peak Users: 200
- Duration: 37 minutes
- Target Environment: Production

## Results
- Average Response Time: $(jq '.metrics.http_req_duration.values.avg' results.json)ms
- 95th Percentile: $(jq '.metrics.http_req_duration.values["p(95)"]' results.json)ms
- Error Rate: $(jq '.metrics.http_req_failed.values.rate' results.json)%
- Total Requests: $(jq '.metrics.http_reqs.values.count' results.json)

## Status
- Performance Targets: $([ $(jq '.metrics.http_req_duration.values["p(95)"]' results.json | cut -d. -f1) -lt 500 ] && echo "✅ PASS" || echo "❌ FAIL")
- Error Rate Target: $([ $(jq '.metrics.http_req_failed.values.rate' results.json | cut -d. -f1) -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")
EOF
```

## Automated Load Testing

### CI/CD Integration

Add load testing to deployment pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
          sudo mv k6 /usr/local/bin/
      
      - name: Run Load Test
        env:
          BASE_URL: ${{ secrets.PRODUCTION_API_URL }}
          AUTH_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
        run: |
          cd tests/load-testing
          k6 run --out json=results.json api-load-test.js
      
      - name: Analyze Results
        run: |
          # Fail if performance targets not met
          ERROR_RATE=$(jq '.metrics.http_req_failed.values.rate' tests/load-testing/results.json)
          P95_TIME=$(jq '.metrics.http_req_duration.values["p(95)"]' tests/load-testing/results.json)
          
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "❌ Error rate too high: $ERROR_RATE"
            exit 1
          fi
          
          if (( $(echo "$P95_TIME > 500" | bc -l) )); then
            echo "❌ Response time too high: ${P95_TIME}ms"
            exit 1
          fi
          
          echo "✅ Load test passed"
      
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: tests/load-testing/results.json
```

This comprehensive load testing setup ensures the Fijian RAG App can handle production traffic and meet performance targets.
# CareChain Backend Scalability Guide

This document describes the scalability features implemented to handle **1000+ concurrent users** and high-volume operations.

## Architecture Overview

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │   (Nginx/ALB)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │ Worker 1  │  │ Worker 2  │  │ Worker N  │  (Cluster Mode)
       └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │  - Rate Limit   │
                    │  - Circuit Brk  │
                    │  - Caching      │
                    │  - Request Q    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │PostgreSQL │       │   Redis   │       │  BullMQ   │
   │  (Pool)   │       │  Cluster  │       │  Queues   │
   └───────────┘       └───────────┘       └───────────┘
```

## Key Features

### 1. API Gateway (`src/gateway/`)

Central request handling with:

- **Redis-based Rate Limiting**: Distributed rate limiting across all workers
- **Circuit Breaker**: Prevents cascade failures by stopping requests to failing services
- **Caching Layer**: Redis + memory L1 cache for fast response times
- **Request Queue**: Queues high-volume requests using BullMQ

### 2. Redis Connection Pool (`src/config/redisCluster.ts`)

- Connection pooling for efficient Redis connections
- Automatic failover and retry logic
- Support for Redis Cluster in production
- Memory fallback when Redis is unavailable

### 3. Job Queue Service (`src/services/jobQueue.service.ts`)

Handles high-volume job postings:

- **Single Job Posting**: Queued processing for load distribution
- **Bulk Operations**: Process 1000+ jobs efficiently in batches
- **Priority Queuing**: Urgent jobs get processed first
- **Automatic Retries**: Failed jobs retry with exponential backoff

### 4. Caching Service (`src/services/cache.service.ts`)

Multi-tier caching:

- L1 Cache: In-memory for fastest access
- L2 Cache: Redis for distributed caching
- Automatic cache invalidation
- Batch operations for efficiency

### 5. Cluster Mode (`src/config/cluster.ts`)

Multi-process scaling:

- Automatic worker spawning based on CPU count
- Graceful shutdown with connection draining
- Automatic worker restart on crash

## API Endpoints

### Bulk Job Posting

```http
POST /api/v1/hospital/jobs/bulk
Content-Type: application/json
Authorization: Bearer <token>

{
  "jobs": [
    {
      "title": "Cardiologist",
      "specialization": "Cardiology",
      "jobType": "full-time",
      ...
    },
    ...
  ]
}
```

Response:
```json
{
  "success": true,
  "message": "Jobs queued for creation",
  "data": {
    "batchId": "bulk-1707307200000-abc123",
    "totalJobs": 1000,
    "estimatedTime": "20s"
  }
}
```

### Check Bulk Status

```http
GET /api/v1/hospital/jobs/bulk/:batchId
Authorization: Bearer <token>
```

### Queue Single Job (High Load)

```http
POST /api/v1/hospital/jobs/queue
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Neurologist",
  "specialization": "Neurology",
  ...
}
```

### Queue Statistics

```http
GET /api/v1/hospital/jobs/queue-stats
Authorization: Bearer <token>
```

## Health Checks

### Basic Health
```http
GET /api/v1/health
```

### Readiness (for load balancers)
```http
GET /api/v1/health/ready
```

### Liveness (for Kubernetes)
```http
GET /api/v1/health/live
```

### Detailed Metrics
```http
GET /api/v1/health/detailed
```

### Prometheus Metrics
```http
GET /api/v1/health/metrics
```

## Configuration

Add to your `.env` file:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Cluster Mode
CLUSTER_ENABLED=true
CLUSTER_WORKERS=4

# API Gateway
GATEWAY_RATE_LIMITING=true
GATEWAY_CIRCUIT_BREAKER=true
GATEWAY_CACHING=true
GATEWAY_REQUEST_QUEUE=true

# Job Queue
QUEUE_CONCURRENCY=50
QUEUE_BULK_BATCH_SIZE=100

# Database Pool
DB_POOL_MIN=5
DB_POOL_MAX=50
```

## Load Testing

Recommended tools:
- **Artillery**: For API load testing
- **k6**: For JavaScript-based load tests
- **wrk**: For HTTP benchmarking

Example Artillery test:
```yaml
config:
  target: 'http://localhost:5001'
  phases:
    - duration: 60
      arrivalRate: 100
      name: "Warm up"
    - duration: 120
      arrivalRate: 500
      name: "Ramp up"
    - duration: 300
      arrivalRate: 1000
      name: "Peak load"

scenarios:
  - name: "Create Job"
    flow:
      - post:
          url: "/api/v1/hospital/jobs"
          headers:
            Authorization: "Bearer {{ $processEnvironment.TOKEN }}"
          json:
            title: "Test Doctor"
            specialization: "General"
```

## Scaling Recommendations

### Horizontal Scaling

1. **Enable Cluster Mode**:
   ```env
   CLUSTER_ENABLED=true
   CLUSTER_WORKERS=0  # Auto-detect CPU count
   ```

2. **Use a Load Balancer**:
   - Nginx (on-premise)
   - AWS ALB / ELB
   - Google Cloud Load Balancing

3. **Redis Cluster**:
   - Minimum 3 master nodes
   - Recommended 6 nodes (3 master + 3 replica)

### Vertical Scaling

1. **Increase Node.js Memory**:
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

2. **Database Connections**:
   ```env
   DB_POOL_MIN=10
   DB_POOL_MAX=100
   ```

### Production Checklist

- [ ] Redis running in cluster mode
- [ ] PostgreSQL with connection pooling (PgBouncer recommended)
- [ ] Load balancer configured with health checks
- [ ] Cluster mode enabled
- [ ] Monitoring set up (Prometheus/Grafana)
- [ ] Logging aggregation (ELK/CloudWatch)
- [ ] Auto-scaling configured
- [ ] Database read replicas for read-heavy workloads

## Performance Benchmarks

Expected performance with recommended configuration:

| Metric | Value |
|--------|-------|
| Concurrent Users | 1000+ |
| Requests/Second | 5000+ |
| Job Postings/Second | 200+ |
| Bulk Jobs (1000) | < 30 seconds |
| Response Time (p95) | < 200ms |
| Response Time (p99) | < 500ms |

## Troubleshooting

### High Memory Usage
- Reduce `DB_POOL_MAX`
- Reduce `QUEUE_CONCURRENCY`
- Increase Node.js memory limit

### Slow Bulk Operations
- Increase `QUEUE_BULK_BATCH_SIZE`
- Add more Redis nodes
- Check database query performance

### Rate Limiting Too Aggressive
- Increase `RATE_LIMIT_MAX_REQUESTS`
- Increase `RATE_LIMIT_WINDOW_MS`

### Circuit Breaker Opening
- Check downstream service health
- Increase failure threshold
- Check network connectivity

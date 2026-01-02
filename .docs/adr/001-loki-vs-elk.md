# ADR 001: Loki + Promtail over ELK Stack for Logging

**Status:** Accepted  
**Context:** M6 - Observability Implementation

---

## Context

We needed to implement centralized logging for Project Yggdrasil to support operational visibility, debugging, and security monitoring. Two main options were evaluated:

1. **ELK Stack** (Elasticsearch, Logstash, Kibana)
2. **Loki + Promtail** (with Grafana)

---

## Decision

We chose **Loki + Promtail with Grafana** for centralized logging.

---

## Rationale

### Resource Efficiency
- **Loki**: ~150MB RAM, minimal CPU
- **Elasticsearch**: ~1GB RAM minimum, higher CPU usage
- **Impact:** Development machines can run full stack comfortably

### Simplified Architecture
- Loki integrates seamlessly with existing Grafana (used for Prometheus metrics)
- Single UI for logs and metrics reduces cognitive load
- Promtail configuration simpler than Logstash pipelines

### Cost of Indexing
- **Loki**: Labels-only indexing (lower storage, faster writes)
- **Elasticsearch**: Full-text indexing (higher storage, slower writes)
- **For our use case:** Label-based queries (service, level, event) sufficient

### Query Performance
- **ELK**: Faster full-text search
- **Loki**: Faster label-based queries
- **Our query patterns:** Primarily filter by service/level, then grep content
- **Verdict:** Loki matches our query patterns better

### Learning Curve
- Team already familiar with Prometheus/Grafana ecosystem
- LogQL similar to PromQL (consistent query language)
- Less operational complexity for small team

### Scalability Trade-offs
- **ELK**: Better for massive scale (multi-TB logs/day)
- **Loki**: Better for moderate scale (<100GB logs/day)
- **Our scale:** ~1-10GB logs/day → Loki sufficient

---

## Consequences

### Positive
- ✅ Lower resource footprint
- ✅ Unified Grafana UI for logs + metrics
- ✅ Simpler operations (fewer moving parts)
- ✅ Faster time to production
- ✅ Better suited for containerized environments

### Negative
- ❌ Limited full-text search capability
- ❌ Less mature ecosystem than ELK
- ❌ Harder to migrate to if we outgrow Loki
- ❌ Fewer advanced analytics features

### Neutral
- Query language different from SQL (but similar to PromQL)
- Retention and cardinality must be managed carefully

---

## Alternatives Considered

### 1. ELK Stack
**Pros:**
- Industry standard
- Powerful full-text search
- Rich ecosystem of integrations
- Advanced analytics (ML, anomaly detection)

**Cons:**
- High resource usage (1GB+ RAM per instance)
- Complex setup (3+ services)
- Over-engineered for our scale
- Higher operational burden

**Why Rejected:** Resource overhead and complexity not justified for our scale

### 2. Splunk / Datadog / Cloud Logging
**Pros:**
- Enterprise features
- Managed service
- Excellent UX

**Cons:**
- Significant cost
- Vendor lock-in
- Not self-hosted (privacy concerns for training platform)

**Why Rejected:** Cost prohibitive, prefer self-hosted

### 3. Fluentd + Custom Backend
**Pros:**
- Maximum flexibility
- Plugin ecosystem

**Cons:**
- Higher development effort
- No out-of-box UI
- More components to maintain

**Why Rejected:** Reinventing the wheel, time to market too long

---

## Implementation Notes

### Configuration
- **Retention:** 7 days (configurable in `loki-config.yaml`)
- **Storage:** Filesystem (BoltDB-shipper mode)
- **Cardinality:** Limited labels to prevent explosion

### Migration Path
If we outgrow Loki:
1. Promtail can forward to multiple destinations
2. Export historical logs from Loki
3. Import to Elasticsearch
4. Swap Grafana datasource
5. Minimal application changes (structured logging remains)

### Monitoring the Logging System
- Loki metrics exposed to Prometheus
- Alerting on Loki unavailability
- Monitor log ingestion rate and storage growth

---

## References

- [Loki Design Principles](https://grafana.com/docs/loki/latest/fundamentals/overview/)
- [Loki vs ELK Comparison](https://grafana.com/blog/2021/03/03/how-loki-compares-to-other-log-aggregation-systems/)
- [Promtail Architecture](https://grafana.com/docs/loki/latest/clients/promtail/)

---
 
**Next Review:** 2026-03-11 (or when log volume exceeds 50GB/day)

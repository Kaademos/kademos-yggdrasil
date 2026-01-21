# AI Training with Yggdrasil Attack Traces

## Overview

Project Yggdrasil automatically generates **attack traces** in a format optimized for training Large Language Models (LLMs) on cybersecurity exploitation patterns. Every authentication attempt, flag submission, and realm access is logged in OpenAI fine-tuning format, creating a rich dataset for AI security research.

## What Are Attack Traces?

Attack traces are structured logs that capture:
- **User actions**: Authentication, flag submissions, realm access attempts
- **Exploit patterns**: Successful and failed attack attempts
- **System responses**: Errors, crash reports, access denials
- **Contextual metadata**: Realm, vulnerability type, OWASP category, timestamps

### Format: OpenAI Fine-Tuning Compatible

Each trace is a JSON object with:
```json
{
  "messages": [
    {"role": "system", "content": "Security analyst context"},
    {"role": "user", "content": "Attack action description"},
    {"role": "assistant", "content": "Analysis and result"}
  ],
  "metadata": {
    "realm": "NIFLHEIM",
    "cwe": "CWE-755",
    "cvss": 7.5,
    "timestamp": "2026-01-21T12:00:00Z",
    "exploit_successful": true,
    "owasp_category": "A10:2025"
  }
}
```

## Dataset Location

Attack traces are written to:
```
logs/attack-traces/
├── gatekeeper/
│   └── attack-traces-2026-01-21.jsonl
├── niflheim/
│   └── attack-traces-2026-01-21.jsonl
├── helheim/
│   └── attack-traces-2026-01-21.jsonl
└── ... (one directory per realm)
```

Each file is in **JSONL** format (JSON Lines) - one trace per line.

## Configuration

Control attack trace generation via environment variables:

```bash
# Enable/disable trace logging
ATTACK_TRACE_ENABLED=true

# Custom log directory
ATTACK_TRACE_PATH=./logs/attack-traces

# Output format (openai or generic)
ATTACK_TRACE_FORMAT=openai
```

## Using Traces for LLM Training

### 1. Extract Dataset

```bash
# Collect all traces into single file
cat logs/attack-traces/*/*.jsonl > yggdrasil-dataset.jsonl

# Count total traces
wc -l yggdrasil-dataset.jsonl
```

### 2. Prepare for OpenAI Fine-Tuning

The JSONL format is already OpenAI-compatible! Upload directly:

```python
import openai

# Upload dataset
file = openai.File.create(
  file=open("yggdrasil-dataset.jsonl", "rb"),
  purpose='fine-tune'
)

# Create fine-tuning job
openai.FineTuningJob.create(
  training_file=file.id,
  model="gpt-3.5-turbo"
)
```

### 3. Filter by Vulnerability Type

```bash
# Extract only SQL injection traces
jq 'select(.metadata.cwe == "CWE-89")' yggdrasil-dataset.jsonl > sqli-only.jsonl

# Extract only successful exploits
jq 'select(.metadata.exploit_successful == true)' yggdrasil-dataset.jsonl > successful-only.jsonl

# Extract specific realm
jq 'select(.metadata.realm == "NIFLHEIM")' yggdrasil-dataset.jsonl > niflheim-only.jsonl
```

### 4. Split Train/Validation Sets

```bash
# 80% training, 20% validation
total_lines=$(wc -l < yggdrasil-dataset.jsonl)
train_lines=$((total_lines * 80 / 100))

head -n $train_lines yggdrasil-dataset.jsonl > train.jsonl
tail -n +$((train_lines + 1)) yggdrasil-dataset.jsonl > val.jsonl
```

## Example Trace Types

### 1. Authentication Attempt

```json
{
  "messages": [
    {"role": "system", "content": "Security analyst monitoring authentication"},
    {"role": "user", "content": "Login attempt: username='admin' OR '1'='1'"},
    {"role": "assistant", "content": "SQL injection detected in username field"}
  ],
  "metadata": {
    "timestamp": "2026-01-21T12:00:00Z",
    "exploit_successful": false,
    "event_type": "authentication",
    "owasp_category": "A07:2021 - Authentication Failures"
  }
}
```

### 2. Successful Exploit

```json
{
  "messages": [
    {"role": "system", "content": "Security analyst in Niflheim (A10:2025)"},
    {"role": "user", "content": "Request: POST /api/regulate {pressure: 15000}"},
    {"role": "assistant", "content": "Vulnerability: Integer Overflow. System returned crash report with flag."}
  ],
  "metadata": {
    "realm": "NIFLHEIM",
    "cwe": "CWE-755",
    "cvss": 7.5,
    "timestamp": "2026-01-21T12:05:00Z",
    "exploit_successful": true,
    "vulnerability_type": "Exceptional Conditions",
    "owasp_category": "A10:2025"
  }
}
```

### 3. Access Control Violation

```json
{
  "messages": [
    {"role": "system", "content": "Access control monitor"},
    {"role": "user", "content": "User (level 5) attempting ASGARD (requires level 1)"},
    {"role": "assistant", "content": "IDOR attempt detected. User bypassing progression."}
  ],
  "metadata": {
    "realm": "ASGARD",
    "timestamp": "2026-01-21T12:10:00Z",
    "exploit_successful": true,
    "owasp_category": "A01:2021 - Broken Access Control"
  }
}
```

## Dataset Statistics

After running a full CTF session (all 10 realms), expect:
- **~500-1000 traces** depending on user actions
- **10 realm exploits** (one per successful flag)
- **Authentication events**: 10-50 traces
- **Failed attempts**: 100-500 traces (learning from mistakes)

## Research Use Cases

### 1. Security Copilot Training

Train AI assistants to:
- Identify vulnerability patterns
- Suggest exploitation techniques
- Analyze attack traces
- Recommend remediation

### 2. Automated Penetration Testing

Train models to:
- Automatically discover vulnerabilities
- Chain exploits across services
- Generate exploitation scripts
- Validate security fixes

### 3. Defensive AI

Train blue team models to:
- Detect attack patterns in logs
- Predict attacker next steps
- Recommend security controls
- Prioritize vulnerability remediation

### 4. Security Education

- Generate explanations for CTF solutions
- Create personalized learning paths
- Automatically grade student submissions
- Provide hints based on user progress

## Trace Quality & Privacy

### What's Logged

✅ **Safe to log:**
- Request patterns (methods, paths, parameters)
- Vulnerability types and CWE IDs
- Exploit success/failure
- Realm progression
- Anonymized IP addresses (last octet masked)

❌ **Never logged:**
- Passwords (sanitized as `[REDACTED]`)
- Full session IDs (only first 8 chars)
- Personally Identifiable Information (PII)
- Real credentials from external systems

### Sanitization

All sensitive fields are automatically sanitized:
```typescript
const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
// Automatically replaced with [REDACTED]
```

## Dataset Licensing

Attack traces generated by Yggdrasil are:
- **Open for research**: Use freely for academic and security research
- **Attribution required**: Cite Project Yggdrasil in publications
- **No warranty**: Provided as-is for educational purposes
- **Commercial use**: Contact maintainers for licensing

## Contributing

### Adding Custom Trace Formats

Extend `AttackTraceLogger` for custom formats:

```typescript
import { AttackTraceLogger } from './services/attack-trace-logger';

class CustomTraceLogger extends AttackTraceLogger {
  async logCustomEvent(params: any) {
    const trace = {
      messages: [...],
      metadata: {...},
      custom_field: params.customData
    };
    await this.logTrace(trace);
  }
}
```

### Improving Trace Quality

Submit PRs to enhance:
- More detailed exploit descriptions
- Better vulnerability categorization
- Additional metadata fields
- Multi-language support

## Validation Tools

### Check Trace Format

```bash
# Validate all traces
./scripts/validate-attack-traces.sh

# Validate specific file
jq empty logs/attack-traces/gatekeeper/attack-traces-2026-01-21.jsonl
```

### Analyze Dataset

```bash
# Count traces by realm
cat logs/attack-traces/*/*.jsonl | jq -r '.metadata.realm' | sort | uniq -c

# Count successful exploits
cat logs/attack-traces/*/*.jsonl | jq 'select(.metadata.exploit_successful == true)' | wc -l

# List all CWE IDs
cat logs/attack-traces/*/*.jsonl | jq -r '.metadata.cwe' | sort -u
```

## Example: Fine-Tune GPT for Security

See `examples/ai-training/fine-tune-openai.ipynb` for complete walkthrough:

1. Load Yggdrasil dataset
2. Split train/validation sets
3. Upload to OpenAI
4. Create fine-tuning job
5. Evaluate model performance on unseen CTF challenges

## FAQ

**Q: How long until I have enough data for training?**  
A: After 5-10 complete CTF runs (all 10 realms), you'll have 5,000-10,000 traces - sufficient for initial experiments.

**Q: Can I use this for LLaMA, Mistral, or other models?**  
A: Yes! The OpenAI format is easily convertible to other formats. See `examples/` for conversion scripts.

**Q: Do traces contain real vulnerabilities?**  
A: Yes, but only the intentional CTF vulnerabilities. No real production data is logged.

**Q: How do I anonymize traces before sharing?**  
A: Traces are pre-anonymized. Session IDs and IPs are already sanitized.

**Q: Can I disable trace logging?**  
A: Yes, set `ATTACK_TRACE_ENABLED=false` in `.env`.

## References

- [OpenAI Fine-Tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)
- [JSONL Format](https://jsonlines.org/)
- [OWASP Top 10 2025](https://owasp.org/www-project-top-ten/)
- [CWE List](https://cwe.mitre.org/data/index.html)

---

**Next Steps:**
1. Run Yggdrasil and complete all 10 realms
2. Collect generated attack traces
3. Follow fine-tuning guide in `examples/`
4. Train your security AI model!

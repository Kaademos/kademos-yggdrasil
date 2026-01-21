# Scanner Benchmarking with Yggdrasil

## Overview

Project Yggdrasil provides **comprehensive vulnerability manifests** for all 10 realms, making it an ideal platform for benchmarking automated security scanners. Each manifest documents vulnerabilities with CWE IDs, CVSS scores, exact endpoints, and expected scanner test cases.

## Why Benchmark with Yggdrasil?

### Advantages

✅ **Known Vulnerabilities**: All 10 OWASP Top 10 2025 categories represented  
✅ **Documented Endpoints**: Exact paths, parameters, and exploit indicators  
✅ **Varying Difficulty**: Beginner to Expert level vulnerabilities  
✅ **Real-World Patterns**: Production-like microservices architecture  
✅ **Multi-Language**: Node.js, Java, diverse technology stack  
✅ **Controlled Environment**: Safe to scan without legal concerns  
✅ **Reproducible**: Docker-based, consistent environment

### What You Can Test

- **Detection Accuracy**: True positive vs false positive rates
- **Coverage**: Which OWASP categories are detected
- **Depth**: Can scanner find multi-stage vulnerabilities?
- **False Negatives**: Which known vulnerabilities are missed?
- **Performance**: Time to scan, resource usage
- **Reporting Quality**: How well are findings documented?

---

## Vulnerability Manifests

### Location

All realm manifests are located at:
```
realms/{realm-name}/manifest.json
```

### Manifest Structure

Each manifest contains:

```json
{
  "realm": "NIFLHEIM",
  "level": 10,
  "owasp": "A10:2025",
  "title": "Exceptional Conditions",
  "vulnerabilities": [
    {
      "id": "NIF-001",
      "type": "Integer Overflow",
      "cwe": "CWE-755",
      "cvss": {
        "version": "3.1",
        "score": 7.5,
        "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
      },
      "endpoints": [
        {
          "method": "POST",
          "path": "/api/regulate",
          "vulnerable": true,
          "parameters": {...}
        }
      ],
      "scanner_test_cases": [...]
    }
  ]
}
```

### Available Realms

| Realm | Level | OWASP | Vulnerability | Difficulty |
|-------|-------|-------|--------------|------------|
| Niflheim | 10 | A10:2025 | Exceptional Conditions | Beginner |
| Helheim | 9 | A09:2025 | Logging Failures | Easy |
| Svartalfheim | 8 | A08:2025 | Insecure Deserialization | Hard |
| Jotunheim | 7 | A07:2025 | Session Fixation | Medium |
| Muspelheim | 6 | A06:2025 | Race Conditions | Hard |
| Nidavellir | 5 | A05:2025 | SQL Injection | Medium |
| Vanaheim | 4 | A04:2025 | Weak PRNG | Medium-Hard |
| Midgard | 3 | A03:2025 | Supply Chain | Hard |
| Alfheim | 2 | A02:2025 | SSRF / IMDS | Hard |
| Asgard | 1 | A01:2025 | IDOR + SQLi + SSRF | Expert |

---

## Scanner Integration

### 1. Nuclei

Nuclei is a fast, template-based vulnerability scanner.

#### Installation

```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
```

#### Run Nuclei Against Yggdrasil

```bash
# Start Yggdrasil
make up

# Basic scan
nuclei -u http://localhost:8080 -severity critical,high,medium

# Scan specific realm
nuclei -u http://localhost:8080/realms/niflheim/ -severity critical,high

# Full scan with all templates
nuclei -u http://localhost:8080 -t ~/nuclei-templates/ -severity critical,high,medium

# Save results
nuclei -u http://localhost:8080 -o nuclei-results.json -json
```

#### Benchmarking Script

See `scripts/scanners/nuclei-runner.sh` (coming in Week 3)

#### Expected Detections

- **Niflheim**: Detect crash reports with sensitive data
- **Helheim**: Find exposed log files
- **Nidavellir**: Identify SQL injection
- **Jotunheim**: Session fixation patterns
- **Alfheim**: SSRF vulnerabilities

### 2. OWASP ZAP

ZAP is a comprehensive web application security scanner.

#### Installation

```bash
# Docker
docker pull zaproxy/zap-stable

# Or download from https://www.zaproxy.org/download/
```

#### Run ZAP Against Yggdrasil

```bash
# Start Yggdrasil
make up

# Baseline scan (passive)
docker run -t zaproxy/zap-stable zap-baseline.py \
  -t http://localhost:8080 \
  -r zap-baseline-report.html

# Full scan (active)
docker run -t zaproxy/zap-stable zap-full-scan.py \
  -t http://localhost:8080 \
  -r zap-full-report.html

# Scan specific realm
docker run -t zaproxy/zap-stable zap-full-scan.py \
  -t http://localhost:8080/realms/nidavellir/ \
  -r nidavellir-scan.html
```

#### API Mode

```bash
# Start ZAP daemon
docker run -u zap -p 8090:8090 -d zaproxy/zap-stable \
  zap.sh -daemon -host 0.0.0.0 -port 8090 -config api.disablekey=true

# Run scans via API
curl "http://localhost:8090/JSON/spider/action/scan/?url=http://localhost:8080"
curl "http://localhost:8090/JSON/ascan/action/scan/?url=http://localhost:8080"
```

### 3. Burp Suite

Burp Suite is a popular penetration testing tool.

#### Manual Testing

1. Configure Burp as HTTP proxy
2. Navigate through Yggdrasil in browser
3. Use Burp's active scanner
4. Review findings against manifests

#### Automated Scans

```bash
# Using Burp Suite Professional CLI
burp-rest-api --burp.jar=/path/to/burp.jar \
  --headless.mode=true \
  --project.file=yggdrasil.burp
```

### 4. Custom Scanner Integration

#### Using Manifests Programmatically

```python
import json
import requests

# Load manifest
with open('realms/niflheim/manifest.json') as f:
    manifest = json.load(f)

# Test each vulnerable endpoint
for vuln in manifest['vulnerabilities']:
    for endpoint in vuln['endpoints']:
        if endpoint['vulnerable']:
            url = f"http://localhost:8080/realms/niflheim{endpoint['path']}"
            
            # Run your scanner tests
            response = requests.request(endpoint['method'], url)
            
            # Compare against expected behavior
            print(f"Testing {endpoint['method']} {endpoint['path']}")
            print(f"Expected CWE: {vuln['cwe']}")
            print(f"Scanner detected: ???")
```

---

## Benchmarking Methodology

### 1. Prepare Environment

```bash
# Clone and start Yggdrasil
git clone <repo-url>
cd kademos-yggdrasil
make setup
make up

# Verify all services are running
make test-health
```

### 2. Extract Ground Truth

```bash
# Generate expected vulnerabilities list
for manifest in realms/*/manifest.json; do
  jq -r '.vulnerabilities[] | "\(.cwe) - \(.type)"' "$manifest"
done > expected-vulnerabilities.txt

# Count by severity
jq -r '.vulnerabilities[].cvss.score' realms/*/manifest.json | \
  awk '{
    if ($1 >= 9.0) print "Critical"
    else if ($1 >= 7.0) print "High"
    else if ($1 >= 4.0) print "Medium"
    else print "Low"
  }' | sort | uniq -c
```

### 3. Run Scanner

```bash
# Run your scanner
your-scanner http://localhost:8080 -o results.json

# Or use provided scripts
./scripts/scanners/nuclei-runner.sh
./scripts/scanners/zap-runner.sh
```

### 4. Compare Results

```bash
# Extract detected CWEs
jq -r '.findings[].cwe' results.json | sort | uniq > detected-cwes.txt

# Compare with expected
comm -23 expected-vulnerabilities.txt detected-cwes.txt > missed.txt
comm -13 expected-vulnerabilities.txt detected-cwes.txt > false-positives.txt

# Calculate metrics
TOTAL=$(wc -l < expected-vulnerabilities.txt)
DETECTED=$(wc -l < detected-cwes.txt)
MISSED=$(wc -l < missed.txt)
echo "Detection Rate: $(echo "scale=2; $DETECTED / $TOTAL * 100" | bc)%"
```

### 5. Generate Scorecard

```python
# scripts/scanners/generate-scorecard.py

import json

def generate_scorecard(scanner_results, manifests):
    scorecard = {
        'scanner': 'YourScanner',
        'version': '1.0.0',
        'scan_date': '2026-01-21',
        'metrics': {
            'total_vulnerabilities': 0,
            'detected': 0,
            'missed': 0,
            'false_positives': 0,
            'detection_rate': 0.0
        },
        'by_category': {},
        'by_severity': {}
    }
    
    # Compare and populate scorecard
    # ... implementation ...
    
    return scorecard

# Output
print(json.dumps(scorecard, indent=2))
```

---

## Evaluation Metrics

### Detection Accuracy

```
Detection Rate = (True Positives) / (Total Known Vulnerabilities)
False Positive Rate = (False Positives) / (Total Findings)
Precision = TP / (TP + FP)
Recall = TP / (TP + FN)
F1 Score = 2 * (Precision * Recall) / (Precision + Recall)
```

### Coverage by OWASP Category

| Category | Known Vulns | Detected | Missed | Detection % |
|----------|-------------|----------|--------|-------------|
| A01 | 3 | 2 | 1 | 67% |
| A02 | 2 | 2 | 0 | 100% |
| A03 | 2 | 1 | 1 | 50% |
| ... | ... | ... | ... | ... |

### Time Performance

- **Time to Complete**: Total scan duration
- **Time per Realm**: Average time per service
- **Requests per Second**: Scan efficiency
- **Resource Usage**: CPU, memory consumption

---

## Common Scanner Challenges

### Challenge 1: Multi-Stage Vulnerabilities

**Asgard** requires chaining IDOR → SQLi → SSRF

**Can your scanner:**
- Detect each individual vulnerability?
- Chain them together automatically?
- Recognize the full exploit path?

### Challenge 2: Blind Vulnerabilities

**Vanaheim** has PRNG weakness  
**Asgard** has blind SQL injection

**Can your scanner:**
- Detect time-based SQL injection?
- Recognize predictable random patterns?
- Perform statistical analysis?

### Challenge 3: Business Logic Flaws

**Muspelheim** has race conditions  
**Midgard** has dependency confusion

**Can your scanner:**
- Detect TOCTOU vulnerabilities?
- Identify supply chain risks?
- Understand business logic?

### Challenge 4: Language-Specific

**Svartalfheim** is Java (insecure deserialization)

**Can your scanner:**
- Handle multiple languages?
- Recognize serialized objects?
- Test Java-specific vulnerabilities?

---

## Scanner Test Cases

Each manifest includes `scanner_test_cases`:

```json
"scanner_test_cases": [
  {
    "name": "Detect SQL injection",
    "request": {
      "method": "GET",
      "path": "/api/search?q=' OR '1'='1'--"
    },
    "expected_response": {
      "status": 200,
      "body_contains": ["artifacts"]
    }
  }
]
```

### Using Test Cases

```python
import json
import requests

def run_test_case(test_case, base_url):
    req = test_case['request']
    url = base_url + req['path']
    
    response = requests.request(req['method'], url, 
                                json=req.get('body'),
                                headers=req.get('headers', {}))
    
    expected = test_case['expected_response']
    
    # Validate
    if 'status' in expected:
        assert response.status_code == expected['status']
    
    if 'body_contains' in expected:
        for text in expected['body_contains']:
            assert text in response.text
    
    return True
```

---

## Reporting Scanner Results

### Minimal Report Format

```json
{
  "scanner": "MyScannerName",
  "version": "1.0.0",
  "scan_date": "2026-01-21T12:00:00Z",
  "target": "http://localhost:8080",
  "duration_seconds": 120,
  "findings": [
    {
      "realm": "NIDAVELLIR",
      "cwe": "CWE-89",
      "severity": "Critical",
      "cvss_score": 9.8,
      "endpoint": "GET /api/artifacts/search",
      "description": "SQL Injection detected",
      "confidence": "High"
    }
  ],
  "summary": {
    "total_endpoints_tested": 50,
    "vulnerabilities_found": 8,
    "false_positives": 2,
    "scan_coverage": "80%"
  }
}
```

### Publishing Results

1. Save results to `benchmarks/scanner-name/results.json`
2. Run comparison script: `./scripts/compare-scanners.py`
3. Generate HTML report: `./scripts/generate-html-report.py`
4. (Optional) Submit PR with your scanner's scorecard

---

## Example Benchmark

### Nuclei Benchmark

```bash
# Run benchmark
./scripts/scanners/nuclei-runner.sh

# Results
Scanner: Nuclei v3.0.0
Detection Rate: 75% (15/20 vulnerabilities)
False Positives: 3
Time: 45 seconds

Detected:
✅ A05 - SQL Injection (Nidavellir)
✅ A09 - Exposed Logs (Helheim)
✅ A10 - Error Info Disclosure (Niflheim)
✅ A07 - Session Issues (Jotunheim)
✅ A02 - SSRF (Alfheim)

Missed:
❌ A06 - Race Conditions (Muspelheim) - Requires concurrent requests
❌ A04 - Weak PRNG (Vanaheim) - Statistical analysis needed
❌ A03 - Dependency Confusion (Midgard) - Requires package context
❌ A08 - Insecure Deserialization (Svartalfheim) - Java-specific
❌ A01 - Multi-stage IDOR chain (Asgard) - Complex chaining required
```

---

## FAQ

**Q: Can I add my scanner to the benchmark?**  
A: Yes! Submit a PR with your results in `benchmarks/your-scanner/`.

**Q: How often are manifests updated?**  
A: Manifests are versioned. Check `metadata.last_updated` in each file.

**Q: Can I test commercial scanners?**  
A: Absolutely! Yggdrasil is designed for benchmarking all scanners.

**Q: What if my scanner finds a vulnerability not in the manifests?**  
A: Please report it! It might be a legitimate issue or a false positive worth documenting.

**Q: Can I run scanners in CI/CD?**  
A: Yes! See CircleCI config for examples of automated scanning.

---

## Next Steps

1. **Start Yggdrasil**: `make up`
2. **Run Your Scanner**: Against http://localhost:8080
3. **Compare Results**: Use manifest test cases
4. **Generate Scorecard**: Calculate detection metrics
5. **Iterate**: Improve scanner configuration and try again

---

**Resources:**
- Manifests: `realms/*/manifest.json`
- Scanner scripts: `scripts/scanners/` (coming Week 3)
- Example results: `benchmarks/examples/`

**Ready to benchmark your scanner?**

```bash
make up
your-scanner http://localhost:8080
./scripts/compare-with-manifests.py
```

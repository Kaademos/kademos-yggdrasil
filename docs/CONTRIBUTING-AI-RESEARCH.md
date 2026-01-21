# Contributing to AI Research with Yggdrasil

## Overview

Project Yggdrasil is designed to support AI/LLM security research through high-quality attack traces and vulnerability data. We welcome contributions from researchers, practitioners, and developers who want to advance the field of AI-assisted security.

## Ways to Contribute

### 1. AI Training Data Improvements

**What We Need:**
- Enhanced attack trace formats for specific AI frameworks
- Additional metadata for better model training
- Improved trace quality and coverage
- Multi-language attack trace support

**How to Contribute:**
- Propose new trace format enhancements
- Submit PRs for trace logger improvements
- Add support for new AI frameworks (Hugging Face, Anthropic, etc.)
- Improve trace sanitization and quality

**Example:**
```typescript
// Adding new metadata field to attack traces
export interface AttackTraceMetadata {
  // ... existing fields
  attack_vector_classification?: 'automated' | 'manual' | 'social_engineering';
  evasion_techniques?: string[];
  // your enhancement here
}
```

### 2. Dataset Quality

**What We Need:**
- Validation of attack trace accuracy
- Deduplication algorithms
- Trace quality metrics
- Bias detection and mitigation

**How to Contribute:**
- Run quality audits on generated traces
- Propose quality metrics
- Implement trace validation tools
- Document biases in the dataset

**Checklist for Quality Contributions:**
- [ ] Test with real attack scenarios
- [ ] Verify OpenAI format compliance
- [ ] Check for PII/sensitive data leakage
- [ ] Validate metadata accuracy
- [ ] Document quality improvements

### 3. Research Papers & Studies

**What We Need:**
- Academic research using Yggdrasil data
- Benchmarking studies comparing AI models
- Novel applications of attack traces
- Security AI evaluation frameworks

**How to Cite Yggdrasil:**
```bibtex
@software{yggdrasil2026,
  title = {Project Yggdrasil: A Vulnerable-by-Design CTF Platform for AI Security Research},
  author = {Project Yggdrasil Contributors},
  year = {2026},
  url = {https://github.com/your-org/yggdrasil},
  note = {Attack trace dataset and vulnerability manifests}
}
```

**Sharing Your Research:**
- Add your paper to `research/papers/`
- Submit a PR with a summary in `research/README.md`
- Share results on the discussion board
- Present at community meetings

### 4. Model Benchmarks

**What We Need:**
- Benchmark results for different AI models
- Comparative studies (GPT-4 vs LLaMA vs Claude)
- Domain-specific model evaluations
- Zero-shot vs fine-tuned comparisons

**Benchmark Template:**
```json
{
  "model": "gpt-4",
  "training_date": "2026-01-21",
  "dataset_size": 10000,
  "training_duration": "2h 30m",
  "evaluation": {
    "vulnerability_detection_rate": 0.85,
    "false_positive_rate": 0.12,
    "exploit_generation_success": 0.73
  },
  "test_scenarios": [...]
}
```

**Submission Process:**
1. Run your benchmark
2. Save results to `benchmarks/models/{model-name}/`
3. Include methodology and configuration
4. Submit PR with analysis

### 5. New Attack Trace Formats

**What We Need:**
- Support for non-OpenAI formats
- Domain-specific trace formats
- Streaming trace formats
- Compressed trace formats

**Format Requirements:**
- Must be well-documented
- Must preserve original information
- Must be convertible to/from OpenAI format
- Must include validation tools

**Example Contribution:**
```python
# examples/trace-formats/llama-format.py
def convert_to_llama_format(openai_trace):
    """Convert OpenAI trace to LLaMA fine-tuning format"""
    return {
        'instruction': openai_trace['messages'][0]['content'],
        'input': openai_trace['messages'][1]['content'],
        'output': openai_trace['messages'][2]['content']
    }
```

### 6. Evaluation Tools

**What We Need:**
- Automated model evaluation scripts
- Performance benchmarking tools
- Comparison frameworks
- Visualization tools

**Tool Categories:**
- Detection accuracy evaluation
- False positive analysis
- Exploit generation quality
- Response time benchmarking

---

## Research Guidelines

### Ethical Considerations

**✅ Encouraged Uses:**
- Academic research on AI security
- Defensive security tool development
- Security education and training
- Vulnerability detection research
- Red team automation (authorized testing only)

**❌ Prohibited Uses:**
- Unauthorized penetration testing
- Development of malware or exploits for malicious purposes
- Bypassing security controls in production systems
- Automated attacks without permission
- Any illegal activities

### Data Privacy

**Attack Traces:**
- ✅ Safe to use: All traces are automatically sanitized
- ✅ No PII: Passwords, tokens, secrets are redacted
- ✅ Anonymized: Session IDs and IPs are masked
- ✅ Public domain: Traces can be shared for research

**Manifests:**
- ✅ Public information: All vulnerability data is intentional
- ✅ Educational purpose: Designed for learning
- ✅ No secrets: No real production data

### Reproducibility

**Requirements for Research Contributions:**
1. **Version Information:**
   - Yggdrasil version used
   - Attack trace format version
   - Model version and parameters
   
2. **Dataset Details:**
   - Number of traces
   - Date range of collection
   - Filtering criteria
   - Train/validation split
   
3. **Code Availability:**
   - Training scripts
   - Evaluation scripts
   - Preprocessing code
   
4. **Results:**
   - Raw results data
   - Statistical analysis
   - Comparison with baselines

**Example Reproducibility Statement:**
```markdown
## Reproducibility

- Yggdrasil Version: v1.1.0
- Dataset: 10,000 attack traces (2026-01-01 to 2026-01-21)
- Train/Val Split: 80/20
- Model: gpt-3.5-turbo fine-tuned for 3 epochs
- Code: https://github.com/username/repo
- Results: benchmarks/gpt-3.5-results.json
```

---

## Technical Contribution Guidelines

### Adding New Trace Formats

**Step 1: Design the Format**
```typescript
// docs/trace-formats/your-format.md
# Your Format Specification

## Structure
...

## Example
...

## Conversion
...
```

**Step 2: Implement Converter**
```typescript
// utils/trace-converters/your-format.ts
export function convertToYourFormat(openaiTrace: AttackTrace): YourFormat {
  // Implementation
}

export function convertFromYourFormat(yourTrace: YourFormat): AttackTrace {
  // Implementation
}
```

**Step 3: Add Tests**
```typescript
// tests/trace-converters/your-format.test.ts
describe('Your Format Converter', () => {
  it('should convert from OpenAI format', () => {
    // Test implementation
  });
});
```

**Step 4: Document**
- Add format to `docs/AI-TRAINING.md`
- Update examples
- Add conversion script to `scripts/`

### Improving Attack Trace Quality

**Adding New Metadata:**
```typescript
// gatekeeper/src/services/attack-trace-logger.ts
export interface AttackTraceMetadata {
  // ... existing fields
  
  // Your new field
  attack_sophistication?: 'basic' | 'intermediate' | 'advanced';
}
```

**Adding New Event Types:**
```typescript
public async logCustomEvent(params: CustomEventParams): Promise<void> {
  const trace: AttackTrace = {
    messages: [
      // Your message structure
    ],
    metadata: {
      // Your metadata
    }
  };
  
  await this.logTrace(trace);
}
```

### Creating Evaluation Tools

**Template:**
```python
# examples/evaluation/your-tool.py

class SecurityModelEvaluator:
    def __init__(self, model_name, test_dataset):
        self.model = model_name
        self.test_data = test_dataset
    
    def evaluate_detection_accuracy(self):
        """Measure vulnerability detection rate"""
        pass
    
    def evaluate_false_positives(self):
        """Measure false positive rate"""
        pass
    
    def generate_report(self):
        """Generate evaluation report"""
        pass
```

---

## Research Dataset Access

### Standard Dataset

**Attack Trace Dataset:**
- Generated from completing all 10 realms
- ~500-1,000 traces per complete run
- JSONL format (OpenAI compatible)
- Free for academic use

**How to Generate:**
```bash
# Start Yggdrasil
make up

# Complete realms (manually or automated)
# Traces saved to: logs/attack-traces/

# Collect dataset
cat logs/attack-traces/*/*.jsonl > yggdrasil-dataset.jsonl
```

### Pre-Generated Datasets

**Community Datasets:**
- Location: `datasets/community/`
- Various sizes and configurations
- Documented metadata
- Validated quality

**Contributing Your Dataset:**
1. Generate high-quality traces
2. Validate format and quality
3. Document collection methodology
4. Submit PR to `datasets/community/`

---

## Collaboration Opportunities

### Research Partnerships

We're interested in collaborating on:
- Novel AI security applications
- Large-scale model training studies
- Security tool automation
- Educational AI development

**Contact:** Open a GitHub discussion or issue

### Academic Projects

**Student Projects:**
- Master's theses on AI security
- PhD research on attack detection
- Undergraduate security education
- Capstone projects

**Support Available:**
- Dataset access
- Technical guidance
- Platform customization
- Co-authorship opportunities (case-by-case)

### Industry Research

**Use Cases:**
- Security AI product development
- Internal tool training
- Red team automation
- Security awareness training

**Commercial Licensing:**
- Open source for research and education
- Commercial use allowed with attribution
- Enterprise support available

---

## Example Research Projects

### 1. Vulnerability Detection AI

**Objective:** Train a model to detect OWASP Top 10 vulnerabilities

**Dataset:** 10,000 attack traces from Yggdrasil  
**Model:** GPT-3.5-turbo fine-tuned  
**Result:** 85% detection rate vs 60% base model

**Code:** `examples/research/vuln-detection/`

### 2. Exploit Generation

**Objective:** Automatically generate exploit code for known vulnerabilities

**Dataset:** 5,000 successful exploit traces  
**Model:** GPT-4 few-shot learning  
**Result:** 73% exploit success rate

**Code:** `examples/research/exploit-generation/`

### 3. False Positive Reduction

**Objective:** Reduce scanner false positives using AI

**Dataset:** Yggdrasil manifests + scanner results  
**Model:** Classifier trained on known vulnerabilities  
**Result:** 40% reduction in false positives

**Code:** `examples/research/false-positive-reduction/`

---

## Submission Process

### For Code Contributions

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b research/your-feature`
3. **Make your changes**
4. **Add tests**
5. **Update documentation**
6. **Submit PR** with description of research contribution

**PR Template:**
```markdown
## Research Contribution: [Title]

### Objective
What problem does this solve?

### Implementation
Technical details of your contribution

### Testing
How was this validated?

### Impact
Expected benefit to AI research

### Documentation
Links to added/updated docs
```

### For Research Papers

1. **Submit paper** to `research/papers/your-paper.pdf`
2. **Add summary** to `research/README.md`
3. **Include results** in `research/results/your-study/`
4. **Open discussion** for community feedback

---

## Community

### Discussion Forums

- **GitHub Discussions:** General research topics
- **Issues:** Bug reports and feature requests
- **Discord:** Real-time community chat (coming soon)

### Monthly Research Meetings

- Share latest findings
- Discuss AI security trends
- Collaborative problem-solving
- Demo new tools and models

**Schedule:** First Friday of each month

### Mailing List

Subscribe for:
- New dataset releases
- Research paper announcements
- Community updates
- Collaboration opportunities

---

## Resources

### Documentation
- [AI Training Guide](./AI-TRAINING.md)
- [Scanner Benchmarking](./SCANNER-BENCHMARKING.md)
- [Attack Trace Format](./AI-TRAINING.md#what-are-attack-traces)

### Examples
- [Fine-Tuning Notebook](../examples/ai-training/fine-tune-openai.ipynb)
- [Scanner Benchmark Script](../examples/scanners/nuclei-benchmark.py)

### Tools
- [Trace Validator](../scripts/validate-attack-traces.sh)
- [Manifest Validator](../scripts/validate-manifests.ts)
- [Comparison Tool](../scripts/scanners/compare-results.py)

---

## FAQs

**Q: Can I use Yggdrasil data in my research paper?**  
A: Yes! Please cite the project and follow ethical guidelines.

**Q: Can I contribute my trained model?**  
A: Yes! Share model cards and weights in the appropriate directory.

**Q: Is there a minimum dataset size for contributions?**  
A: No minimum, but document your methodology clearly.

**Q: Can I request specific features for my research?**  
A: Yes! Open an issue describing your research needs.

**Q: How do I report issues with attack traces?**  
A: Open an issue with trace examples and description of the problem.

**Q: Can I use Yggdrasil for commercial AI product development?**  
A: Yes, with attribution. See LICENSE for details.

---

## Contact

- **GitHub Issues:** Technical questions and bug reports
- **GitHub Discussions:** Research collaboration and ideas
- **Email:** [Coming soon]
- **Twitter:** [Coming soon]

---

**Thank you for contributing to AI security research!** 🚀

Together, we're making AI systems safer and more capable of detecting and preventing security vulnerabilities.

# Instructor Notes - Yggdrasil Platform

**M13: Immersion & Final Polish**

## Overview

This directory contains comprehensive instructor guides for each of the 10 Yggdrasil realms. Each guide provides:

- **Vulnerability Overview** - Technical details of the vulnerability
- **Exploit Walkthrough** - Step-by-step solution path
- **Progressive Hints** - 3-level hint system for student assistance
- **Common Pitfalls** - Where students typically get stuck
- **Assessment Criteria** - How to evaluate student understanding
- **Real-World Context** - Industry examples and relevance

---

## Structure

```
.docs/instructor/
├── README.md                  # This file
├── TEMPLATE.md                # Template for creating new guides
├── realm-01-asgard.md         # Asgard (IDOR + SQLi)
├── realm-02-alfheim.md        # Alfheim (SSRF → IMDS → S3)
├── realm-03-midgard.md        # Midgard (Supply Chain)
├── realm-04-vanaheim.md       # Vanaheim (Weak PRNG)
├── realm-05-nidavellir.md     # Nidavellir (SQLi)
├── realm-06-muspelheim.md     # Muspelheim (Race Condition)
├── realm-07-jotunheim.md      # Jotunheim (Session Fixation)
├── realm-08-svartalfheim.md   # Svartalfheim (Deserialization)
├── realm-09-helheim.md        # Helheim (LFI)
└── realm-10-niflheim.md       # Niflheim (SSRF + Info Leak)
```

---

## Usage

### For Instructors

**Before Class:**
1. Review the relevant realm's instructor notes
2. Understand the vulnerability and exploit path
3. Prepare hints at each difficulty level
4. Review common pitfalls students encounter

**During Class:**
1. Monitor student progress
2. Provide hints based on student's current stage
3. Use assessment criteria to evaluate understanding
4. Reference real-world examples when explaining concepts

**After Class:**
1. Review student solutions for alternative approaches
2. Update instructor notes with new insights
3. Document any new pitfalls discovered

### Hint System

Each realm uses a 3-level progressive hint system:

**Level 1 (Gentle Nudge):**
- Points student in the right direction
- Doesn't reveal solution
- Helps with basic reconnaissance

**Level 2 (Technical Guidance):**
- Provides specific technical details
- May reveal part of the exploit path
- Helps with tool usage

**Level 3 (Near-Solution):**
- Very specific guidance
- Reveals most of the exploit path
- Leaves final step to student

**Example:**
- Level 1: "Have you examined the application's session management?"
- Level 2: "Try using Burp Suite to intercept and modify the session cookie."
- Level 3: "Set the JSESSIONID to a known value before authentication, then use that same session after login."

---

## Assessment Guidelines

### Evaluation Criteria

**Understanding (40% weight):**
- Can explain the vulnerability class
- Understands why the vulnerability exists
- Can describe the attack surface

**Exploitation (40% weight):**
- Successfully exploited the vulnerability
- Used appropriate tools
- Documented the exploit process

**Real-World Application (20% weight):**
- Can relate to real-world scenarios
- Understands mitigation strategies
- Recognizes similar patterns in other systems

### Scoring Rubric

**Excellent (90-100%):**
- Complete exploitation with minimal hints
- Clear documentation of process
- Identifies alternative attack vectors
- Proposes effective mitigations

**Good (75-89%):**
- Successful exploitation with 1-2 hints
- Basic documentation
- Understands core concepts
- Can identify basic mitigations

**Satisfactory (60-74%):**
- Exploitation with multiple hints
- Minimal documentation
- Demonstrates basic understanding
- Needs guidance on mitigations

**Needs Improvement (<60%):**
- Unable to exploit even with hints
- Poor or no documentation
- Lacks understanding of core concepts
- Cannot identify mitigations

---

## Creating New Guides

When adding a new realm or updating existing guides:

1. Copy `TEMPLATE.md`
2. Fill in all sections
3. Test the walkthrough on a fresh instance
4. Have another instructor review
5. Update this README with the new file

---

## Confidentiality

**⚠️ IMPORTANT:**

These instructor notes contain complete solutions and should NEVER be shared with students. Store them securely and ensure student-facing documentation does not include spoilers.

---

## Contributing

To improve instructor notes:

1. Document new pitfalls you observe
2. Add alternative exploit paths
3. Update real-world examples
4. Refine hint levels based on student feedback

Submit updates via pull request to the documentation directory.

---

## Quick Reference

| Realm | Number | Vulnerability | Difficulty | Est. Time |
|-------|--------|---------------|------------|-----------|
| Asgard | 1 | IDOR + SQLi | Medium | 45-60 min |
| Alfheim | 2 | SSRF → IMDS | Hard | 60-90 min |
| Midgard | 3 | Supply Chain | Medium | 45-60 min |
| Vanaheim | 4 | Weak PRNG | Medium | 30-45 min |
| Nidavellir | 5 | SQLi | Easy | 30-45 min |
| Muspelheim | 6 | Race Condition | Hard | 60-75 min |
| Jotunheim | 7 | Session Fixation | Medium | 45-60 min |
| Svartalfheim | 8 | Deserialization | Hard | 60-90 min |
| Helheim | 9 | LFI | Medium | 45-60 min |
| Niflheim | 10 | SSRF + Info Leak | Hard | 75-90 min |

**Total Estimated Time:** 8-10 hours for all realms

---

## Support

For questions about instructor notes:
- [Platform Documentation](/README.md)
- [Operator Guide](/guides/OPERATOR_GUIDE.md)
- [Developer Guide](/guides/DEVELOPER.md)

---

**Last Updated:** 2026-01-02  

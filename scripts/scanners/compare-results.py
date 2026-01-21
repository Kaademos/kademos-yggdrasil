#!/usr/bin/env python3
"""
Scanner Results Comparison Tool

Compares scanner results against expected vulnerabilities from manifests
and generates a comprehensive benchmark scorecard.
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict
from datetime import datetime


class ScannerBenchmark:
    def __init__(self, manifests_dir: str = "realms"):
        self.manifests_dir = Path(manifests_dir)
        self.expected_vulns = self.load_expected_vulnerabilities()
        
    def load_expected_vulnerabilities(self) -> Dict:
        """Load expected vulnerabilities from all manifests"""
        expected = {
            'total': 0,
            'by_realm': {},
            'by_cwe': defaultdict(int),
            'by_owasp': defaultdict(int),
            'by_severity': defaultdict(int),
            'endpoints': []
        }
        
        for manifest_file in self.manifests_dir.glob("*/manifest.json"):
            try:
                with open(manifest_file) as f:
                    manifest = json.load(f)
                    
                realm = manifest['realm']
                expected['by_realm'][realm] = {
                    'level': manifest['level'],
                    'owasp': manifest['owasp'],
                    'vulnerabilities': []
                }
                
                for vuln in manifest.get('vulnerabilities', []):
                    expected['total'] += 1
                    expected['by_cwe'][vuln['cwe']] += 1
                    expected['by_owasp'][manifest['owasp']] += 1
                    
                    cvss_score = vuln.get('cvss', {}).get('score', 0)
                    if cvss_score >= 9.0:
                        severity = 'Critical'
                    elif cvss_score >= 7.0:
                        severity = 'High'
                    elif cvss_score >= 4.0:
                        severity = 'Medium'
                    else:
                        severity = 'Low'
                    expected['by_severity'][severity] += 1
                    
                    expected['by_realm'][realm]['vulnerabilities'].append({
                        'id': vuln['id'],
                        'type': vuln['type'],
                        'cwe': vuln['cwe'],
                        'cvss': cvss_score
                    })
                    
                    # Collect all vulnerable endpoints
                    for endpoint in vuln.get('endpoints', []):
                        if endpoint.get('vulnerable'):
                            expected['endpoints'].append({
                                'realm': realm,
                                'method': endpoint['method'],
                                'path': endpoint['path'],
                                'cwe': vuln['cwe']
                            })
                            
            except Exception as e:
                print(f"Warning: Error loading {manifest_file}: {e}", file=sys.stderr)
                
        return expected
    
    def analyze_nuclei_results(self, results_file: str) -> Dict:
        """Analyze Nuclei JSON results"""
        findings = {
            'total': 0,
            'by_severity': defaultdict(int),
            'by_template': defaultdict(int),
            'detected_cwes': set(),
            'endpoints': []
        }
        
        try:
            with open(results_file) as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        result = json.loads(line)
                        findings['total'] += 1
                        
                        severity = result.get('info', {}).get('severity', 'unknown')
                        findings['by_severity'][severity] += 1
                        
                        template = result.get('info', {}).get('name', 'unknown')
                        findings['by_template'][template] += 1
                        
                        # Try to extract CWE if present
                        classification = result.get('info', {}).get('classification', {})
                        cwe_id = classification.get('cwe-id', [])
                        if cwe_id:
                            for cwe in cwe_id:
                                findings['detected_cwes'].add(f"CWE-{cwe}")
                        
                        findings['endpoints'].append({
                            'url': result.get('matched-at', ''),
                            'template': template,
                            'severity': severity
                        })
                        
                    except json.JSONDecodeError:
                        continue
                        
        except FileNotFoundError:
            print(f"Error: Results file not found: {results_file}", file=sys.stderr)
            return None
            
        return findings
    
    def analyze_zap_results(self, results_file: str) -> Dict:
        """Analyze ZAP JSON results"""
        findings = {
            'total': 0,
            'by_severity': defaultdict(int),
            'by_category': defaultdict(int),
            'detected_cwes': set(),
            'endpoints': []
        }
        
        try:
            with open(results_file) as f:
                zap_data = json.load(f)
                
            for site in zap_data.get('site', []):
                for alert in site.get('alerts', []):
                    findings['total'] += 1
                    
                    risk_code = alert.get('riskcode', '0')
                    risk_map = {'3': 'High', '2': 'Medium', '1': 'Low', '0': 'Informational'}
                    severity = risk_map.get(risk_code, 'Unknown')
                    findings['by_severity'][severity] += 1
                    
                    alert_name = alert.get('name', 'unknown')
                    findings['by_category'][alert_name] += 1
                    
                    # Extract CWE if present
                    cweid = alert.get('cweid')
                    if cweid:
                        findings['detected_cwes'].add(f"CWE-{cweid}")
                    
                    for instance in alert.get('instances', []):
                        findings['endpoints'].append({
                            'url': instance.get('uri', ''),
                            'alert': alert_name,
                            'severity': severity
                        })
                        
        except FileNotFoundError:
            print(f"Error: Results file not found: {results_file}", file=sys.stderr)
            return None
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in results file: {e}", file=sys.stderr)
            return None
            
        return findings
    
    def generate_scorecard(self, scanner_name: str, findings: Dict) -> Dict:
        """Generate benchmark scorecard"""
        if not findings:
            return None
            
        scorecard = {
            'scanner': scanner_name,
            'scan_date': datetime.now().isoformat(),
            'metrics': {},
            'detection': {},
            'summary': {}
        }
        
        # Calculate detection metrics
        detected = findings['total']
        expected = self.expected_vulns['total']
        
        # CWE detection
        expected_cwes = set(self.expected_vulns['by_cwe'].keys())
        detected_cwes = findings['detected_cwes']
        matched_cwes = expected_cwes & detected_cwes
        missed_cwes = expected_cwes - detected_cwes
        
        scorecard['metrics'] = {
            'total_findings': detected,
            'expected_vulnerabilities': expected,
            'detection_rate': round(detected / expected * 100, 2) if expected > 0 else 0,
            'cwe_coverage': round(len(matched_cwes) / len(expected_cwes) * 100, 2) if expected_cwes else 0,
            'cwes_detected': len(detected_cwes),
            'cwes_expected': len(expected_cwes),
            'cwes_matched': len(matched_cwes)
        }
        
        scorecard['detection'] = {
            'matched_cwes': sorted(list(matched_cwes)),
            'missed_cwes': sorted(list(missed_cwes)),
            'extra_cwes': sorted(list(detected_cwes - expected_cwes))
        }
        
        scorecard['summary'] = {
            'findings_by_severity': dict(findings['by_severity']),
            'expected_by_severity': dict(self.expected_vulns['by_severity']),
            'expected_by_owasp': dict(self.expected_vulns['by_owasp'])
        }
        
        return scorecard
    
    def print_scorecard(self, scorecard: Dict):
        """Print formatted scorecard"""
        print("\n" + "="*70)
        print(f"  Yggdrasil Scanner Benchmark Scorecard")
        print("="*70)
        print()
        
        print(f"Scanner: {scorecard['scanner']}")
        print(f"Date: {scorecard['scan_date']}")
        print()
        
        print("Detection Metrics:")
        print("-" * 70)
        metrics = scorecard['metrics']
        print(f"  Total Findings:           {metrics['total_findings']}")
        print(f"  Expected Vulnerabilities: {metrics['expected_vulnerabilities']}")
        print(f"  Detection Rate:           {metrics['detection_rate']}%")
        print(f"  CWE Coverage:             {metrics['cwe_coverage']}%")
        print(f"  CWEs Matched:             {metrics['cwes_matched']}/{metrics['cwes_expected']}")
        print()
        
        print("Severity Distribution:")
        print("-" * 70)
        findings_sev = scorecard['summary']['findings_by_severity']
        expected_sev = scorecard['summary']['expected_by_severity']
        for severity in ['Critical', 'High', 'Medium', 'Low']:
            found = findings_sev.get(severity, 0)
            exp = expected_sev.get(severity, 0)
            print(f"  {severity:12} Found: {found:3} | Expected: {exp:3}")
        print()
        
        print("CWE Detection:")
        print("-" * 70)
        detection = scorecard['detection']
        print(f"  ✅ Detected CWEs: {', '.join(detection['matched_cwes'][:10])}")
        if len(detection['matched_cwes']) > 10:
            print(f"     ... and {len(detection['matched_cwes']) - 10} more")
        
        if detection['missed_cwes']:
            print(f"  ❌ Missed CWEs:   {', '.join(detection['missed_cwes'][:10])}")
            if len(detection['missed_cwes']) > 10:
                print(f"     ... and {len(detection['missed_cwes']) - 10} more")
        
        if detection['extra_cwes']:
            print(f"  ⚠️  Extra CWEs:   {', '.join(detection['extra_cwes'][:5])}")
            print(f"     (These may be false positives or additional findings)")
        print()
        
        print("OWASP Category Coverage:")
        print("-" * 70)
        owasp_expected = scorecard['summary']['expected_by_owasp']
        for category in sorted(owasp_expected.keys()):
            count = owasp_expected[category]
            print(f"  {category}: {count} vulnerabilities")
        print()
        
        print("="*70)
        print()


def main():
    if len(sys.argv) < 3:
        print("Usage: compare-results.py <scanner-type> <results-file>")
        print()
        print("Scanner types: nuclei, zap")
        print()
        print("Examples:")
        print("  ./compare-results.py nuclei scanner-results/nuclei/nuclei-results.json")
        print("  ./compare-results.py zap scanner-results/zap/zap-report.json")
        sys.exit(1)
    
    scanner_type = sys.argv[1].lower()
    results_file = sys.argv[2]
    
    # Initialize benchmark
    benchmark = ScannerBenchmark()
    
    print(f"\n📊 Loading expected vulnerabilities from manifests...")
    print(f"   Total expected: {benchmark.expected_vulns['total']} vulnerabilities")
    print(f"   Across {len(benchmark.expected_vulns['by_realm'])} realms")
    print(f"   Covering {len(benchmark.expected_vulns['by_cwe'])} unique CWEs")
    
    # Analyze results based on scanner type
    print(f"\n🔍 Analyzing {scanner_type.upper()} results from {results_file}...")
    
    if scanner_type == 'nuclei':
        findings = benchmark.analyze_nuclei_results(results_file)
        scanner_name = "Nuclei"
    elif scanner_type == 'zap':
        findings = benchmark.analyze_zap_results(results_file)
        scanner_name = "OWASP ZAP"
    else:
        print(f"Error: Unsupported scanner type: {scanner_type}")
        print("Supported: nuclei, zap")
        sys.exit(1)
    
    if not findings:
        print("Error: Could not analyze results file")
        sys.exit(1)
    
    print(f"   Found {findings['total']} findings")
    
    # Generate and print scorecard
    scorecard = benchmark.generate_scorecard(scanner_name, findings)
    if scorecard:
        benchmark.print_scorecard(scorecard)
        
        # Save scorecard to file
        output_file = f"scanner-results/{scanner_type}-scorecard-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        os.makedirs("scanner-results", exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(scorecard, f, indent=2)
        print(f"💾 Scorecard saved to: {output_file}")
        print()


if __name__ == '__main__':
    main()

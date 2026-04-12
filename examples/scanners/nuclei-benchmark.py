#!/usr/bin/env python3
"""
Nuclei Scanner Benchmark for Yggdrasil

Automated script to run Nuclei against all Yggdrasil realms and generate
a comprehensive benchmark report comparing detected vs expected vulnerabilities.

Usage:
    python nuclei-benchmark.py
    python nuclei-benchmark.py --severity critical,high
    python nuclei-benchmark.py --output results.json
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
from collections import defaultdict


class YggdrasilBenchmark:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.realms = [
            'niflheim', 'helheim', 'svartalfheim', 'jotunheim', 'muspelheim',
            'nidavellir', 'vanaheim', 'midgard', 'alfheim', 'asgard'
        ]
        self.manifests = self.load_manifests()
        
    def load_manifests(self) -> Dict:
        """Load all realm manifests"""
        manifests = {}
        realms_dir = Path(__file__).parent.parent.parent / 'realms'
        
        for realm in self.realms:
            manifest_path = realms_dir / realm / 'manifest.json'
            if manifest_path.exists():
                with open(manifest_path) as f:
                    manifests[realm] = json.load(f)
        
        return manifests
    
    def check_nuclei_installed(self) -> bool:
        """Check if Nuclei is installed"""
        try:
            subprocess.run(['nuclei', '-version'], 
                         capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
    
    def check_yggdrasil_running(self) -> bool:
        """Check if Yggdrasil is running"""
        try:
            import requests
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def run_nuclei_scan(self, target: str, severity: str = "critical,high,medium") -> List[Dict]:
        """Run Nuclei scan against target"""
        print(f"🔍 Scanning {target}...")
        
        cmd = [
            'nuclei',
            '-u', target,
            '-severity', severity,
            '-json',
            '-silent'
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            findings = []
            
            for line in result.stdout.strip().split('\n'):
                if line:
                    try:
                        findings.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
            
            return findings
        except subprocess.TimeoutExpired:
            print(f"⚠️  Scan timeout for {target}")
            return []
        except Exception as e:
            print(f"❌ Scan error for {target}: {e}")
            return []
    
    def scan_all_realms(self, severity: str = "critical,high,medium") -> Dict[str, List[Dict]]:
        """Scan all realms individually"""
        results = {}
        
        print(f"\n🎯 Scanning all {len(self.realms)} realms...")
        print(f"   Severity filter: {severity}")
        print("")
        
        for i, realm in enumerate(self.realms, 1):
            target = f"{self.base_url}/realms/{realm}/"
            print(f"[{i}/{len(self.realms)}] {realm.upper()}", end=" ")
            
            findings = self.run_nuclei_scan(target, severity)
            results[realm] = findings
            
            print(f"→ {len(findings)} findings")
        
        return results
    
    def extract_expected_vulnerabilities(self) -> Dict:
        """Extract expected vulnerabilities from manifests"""
        expected = {
            'total': 0,
            'by_realm': {},
            'by_cwe': defaultdict(int),
            'by_severity': defaultdict(int)
        }
        
        for realm, manifest in self.manifests.items():
            expected['by_realm'][realm] = {
                'count': len(manifest.get('vulnerabilities', [])),
                'cwes': []
            }
            
            for vuln in manifest.get('vulnerabilities', []):
                expected['total'] += 1
                cwe = vuln.get('cwe')
                if cwe:
                    expected['by_cwe'][cwe] += 1
                    expected['by_realm'][realm]['cwes'].append(cwe)
                
                cvss_score = vuln.get('cvss', {}).get('score', 0)
                if cvss_score >= 9.0:
                    expected['by_severity']['Critical'] += 1
                elif cvss_score >= 7.0:
                    expected['by_severity']['High'] += 1
                elif cvss_score >= 4.0:
                    expected['by_severity']['Medium'] += 1
                else:
                    expected['by_severity']['Low'] += 1
        
        return expected
    
    def analyze_results(self, scan_results: Dict[str, List[Dict]], 
                       expected: Dict) -> Dict:
        """Analyze scan results and generate benchmark"""
        analysis = {
            'total_scanned': len(scan_results),
            'total_findings': 0,
            'expected_vulnerabilities': expected['total'],
            'by_realm': {},
            'by_severity': defaultdict(int),
            'detected_cwes': set(),
            'detection_rate': 0.0
        }
        
        for realm, findings in scan_results.items():
            analysis['total_findings'] += len(findings)
            analysis['by_realm'][realm] = {
                'findings': len(findings),
                'expected': expected['by_realm'].get(realm, {}).get('count', 0),
                'templates': set()
            }
            
            for finding in findings:
                severity = finding.get('info', {}).get('severity', 'unknown')
                analysis['by_severity'][severity] += 1
                
                template = finding.get('info', {}).get('name', 'unknown')
                analysis['by_realm'][realm]['templates'].add(template)
                
                # Try to extract CWE
                classification = finding.get('info', {}).get('classification', {})
                cwe_ids = classification.get('cwe-id', [])
                for cwe_id in cwe_ids:
                    analysis['detected_cwes'].add(f"CWE-{cwe_id}")
        
        # Calculate detection rate
        if expected['total'] > 0:
            analysis['detection_rate'] = (analysis['total_findings'] / expected['total']) * 100
        
        # Calculate CWE coverage
        expected_cwes = set(expected['by_cwe'].keys())
        matched_cwes = expected_cwes & analysis['detected_cwes']
        analysis['cwe_coverage'] = {
            'expected': len(expected_cwes),
            'detected': len(analysis['detected_cwes']),
            'matched': len(matched_cwes),
            'coverage_rate': (len(matched_cwes) / len(expected_cwes) * 100) if expected_cwes else 0,
            'matched_cwes': sorted(list(matched_cwes)),
            'missed_cwes': sorted(list(expected_cwes - analysis['detected_cwes']))
        }
        
        return analysis
    
    def print_report(self, analysis: Dict, expected: Dict):
        """Print formatted benchmark report"""
        print("\n" + "="*70)
        print("  Yggdrasil Nuclei Benchmark Report")
        print("="*70)
        print()
        
        print(f"📊 Overall Statistics:")
        print(f"   Expected Vulnerabilities: {expected['total']}")
        print(f"   Total Findings: {analysis['total_findings']}")
        print(f"   Detection Rate: {analysis['detection_rate']:.1f}%")
        print()
        
        print(f"🎯 CWE Coverage:")
        cwe_cov = analysis['cwe_coverage']
        print(f"   Expected CWEs: {cwe_cov['expected']}")
        print(f"   Detected CWEs: {cwe_cov['detected']}")
        print(f"   Matched CWEs: {cwe_cov['matched']}")
        print(f"   Coverage Rate: {cwe_cov['coverage_rate']:.1f}%")
        
        if cwe_cov['matched_cwes']:
            print(f"   ✅ Detected: {', '.join(cwe_cov['matched_cwes'][:10])}")
            if len(cwe_cov['matched_cwes']) > 10:
                print(f"      ... and {len(cwe_cov['matched_cwes']) - 10} more")
        
        if cwe_cov['missed_cwes']:
            print(f"   ❌ Missed: {', '.join(cwe_cov['missed_cwes'][:10])}")
            if len(cwe_cov['missed_cwes']) > 10:
                print(f"      ... and {len(cwe_cov['missed_cwes']) - 10} more")
        print()
        
        print(f"📈 Findings by Severity:")
        for severity in ['critical', 'high', 'medium', 'low']:
            count = analysis['by_severity'].get(severity, 0)
            exp_count = expected['by_severity'].get(severity.title(), 0)
            print(f"   {severity.title():10} Found: {count:3} | Expected: {exp_count:3}")
        print()
        
        print(f"🎭 Results by Realm:")
        print(f"   {'Realm':<15} {'Found':<8} {'Expected':<10} {'Rate':<8}")
        print(f"   {'-'*15} {'-'*8} {'-'*10} {'-'*8}")
        
        for realm in self.realms:
            realm_data = analysis['by_realm'].get(realm, {})
            found = realm_data.get('findings', 0)
            expected_count = realm_data.get('expected', 0)
            rate = (found / expected_count * 100) if expected_count > 0 else 0
            
            print(f"   {realm.upper():<15} {found:<8} {expected_count:<10} {rate:>6.1f}%")
        
        print("\n" + "="*70)
    
    def save_results(self, scan_results: Dict, analysis: Dict, 
                    expected: Dict, filename: str):
        """Save results to JSON file"""
        output = {
            'benchmark_date': datetime.now().isoformat(),
            'scanner': 'Nuclei',
            'base_url': self.base_url,
            'scan_results': {
                realm: [
                    {
                        'template': f.get('info', {}).get('name'),
                        'severity': f.get('info', {}).get('severity'),
                        'matched_at': f.get('matched-at')
                    }
                    for f in findings
                ]
                for realm, findings in scan_results.items()
            },
            'analysis': {
                'total_findings': analysis['total_findings'],
                'expected_vulnerabilities': analysis['expected_vulnerabilities'],
                'detection_rate': analysis['detection_rate'],
                'cwe_coverage': {
                    'expected': analysis['cwe_coverage']['expected'],
                    'detected': analysis['cwe_coverage']['detected'],
                    'matched': analysis['cwe_coverage']['matched'],
                    'coverage_rate': analysis['cwe_coverage']['coverage_rate'],
                    'matched_cwes': analysis['cwe_coverage']['matched_cwes'],
                    'missed_cwes': analysis['cwe_coverage']['missed_cwes']
                },
                'by_severity': dict(analysis['by_severity']),
                'by_realm': {
                    realm: {
                        'findings': data['findings'],
                        'expected': data['expected']
                    }
                    for realm, data in analysis['by_realm'].items()
                }
            },
            'expected': {
                'total': expected['total'],
                'by_severity': dict(expected['by_severity']),
                'by_cwe': dict(expected['by_cwe'])
            }
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"\n💾 Results saved to: {filename}")


def main():
    parser = argparse.ArgumentParser(
        description='Run Nuclei benchmark against Yggdrasil'
    )
    parser.add_argument(
        '--base-url',
        default='http://localhost:8080',
        help='Yggdrasil base URL (default: http://localhost:8080)'
    )
    parser.add_argument(
        '--severity',
        default='critical,high,medium',
        help='Severity levels to scan (default: critical,high,medium)'
    )
    parser.add_argument(
        '--output',
        default='nuclei-benchmark-results.json',
        help='Output file path (default: nuclei-benchmark-results.json)'
    )
    
    args = parser.parse_args()
    
    print("╔════════════════════════════════════════════════════════════╗")
    print("║   Yggdrasil Nuclei Benchmark (Python)                     ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print()
    
    # Initialize benchmark
    benchmark = YggdrasilBenchmark(args.base_url)
    
    # Pre-flight checks
    print("🔍 Pre-flight checks...")
    
    if not benchmark.check_nuclei_installed():
        print("❌ Nuclei is not installed")
        print("\nInstall Nuclei:")
        print("  go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest")
        print("  OR")
        print("  brew install nuclei")
        sys.exit(1)
    print("✅ Nuclei installed")
    
    if not benchmark.check_yggdrasil_running():
        print(f"❌ Yggdrasil is not running at {args.base_url}")
        print("\nStart Yggdrasil:")
        print("  make up")
        sys.exit(1)
    print(f"✅ Yggdrasil running at {args.base_url}")
    
    print(f"✅ Loaded {len(benchmark.manifests)} realm manifests")
    print()
    
    # Run benchmark
    start_time = time.time()
    
    # Scan all realms
    scan_results = benchmark.scan_all_realms(args.severity)
    
    # Extract expected vulnerabilities
    print("\n📋 Loading expected vulnerabilities from manifests...")
    expected = benchmark.extract_expected_vulnerabilities()
    print(f"✅ Expected: {expected['total']} vulnerabilities across {len(expected['by_realm'])} realms")
    
    # Analyze results
    print("\n🔬 Analyzing results...")
    analysis = benchmark.analyze_results(scan_results, expected)
    
    # Calculate duration
    duration = time.time() - start_time
    
    # Print report
    benchmark.print_report(analysis, expected)
    
    print(f"\n⏱️  Total duration: {duration:.1f} seconds")
    
    # Save results
    benchmark.save_results(scan_results, analysis, expected, args.output)
    
    print("\n✅ Benchmark complete!")
    print(f"\nFor detailed scanner guide, see:")
    print(f"  docs/SCANNER-BENCHMARKING.md")


if __name__ == '__main__':
    main()

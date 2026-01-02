#!/usr/bin/env node
/**
 * strip-comments.js
 * 
 * Removes instructor-only comments from source code for player builds.
 * Part of Milestone 8: Comment Stripping Pipeline
 * 
 * Usage:
 *   node scripts/strip-comments.js <source-dir> <output-dir>
 * 
 * Example:
 *   node scripts/strip-comments.js realms/niflheim/src /tmp/niflheim-clean
 * 
 * Banned comment patterns:
 * - VULNERABLE:
 * - EXPLOIT:
 * - SPOILER:
 * - FLAG HERE:
 * - CHALLENGE HINT:
 */

const fs = require('fs');
const path = require('path');

// Patterns that identify instructor-only comments
const BANNED_PATTERNS = [
  /\/\*\*?\s*VULNERABLE:/gi,
  /\/\*\*?\s*EXPLOIT:/gi,
  /\/\*\*?\s*SPOILER:/gi,
  /\/\*\*?\s*FLAG HERE:/gi,
  /\/\*\*?\s*CHALLENGE HINT:/gi,
  /\/\/\s*VULNERABLE:/gi,
  /\/\/\s*EXPLOIT:/gi,
  /\/\/\s*SPOILER:/gi,
  /\/\/\s*FLAG HERE:/gi,
  /\/\/\s*CHALLENGE HINT:/gi,
];

// Statistics
let stats = {
  filesProcessed: 0,
  filesStripped: 0,
  commentsRemoved: 0,
};

/**
 * Strip instructor comments from source code
 * @param {string} content - File content
 * @returns {string} - Cleaned content
 */
function stripComments(content) {
  let cleaned = content;
  let removedCount = 0;

  // Remove single-line comments with banned keywords
  BANNED_PATTERNS.forEach(pattern => {
    const matches = cleaned.match(pattern);
    if (matches) {
      removedCount += matches.length;
      cleaned = cleaned.replace(pattern, '');
    }
  });

  // Remove entire multi-line comment blocks containing banned keywords
  const blockPattern = /\/\*[\s\S]*?(VULNERABLE|EXPLOIT|SPOILER|FLAG HERE|CHALLENGE HINT)[\s\S]*?\*\//gi;
  const blockMatches = cleaned.match(blockPattern);
  if (blockMatches) {
    removedCount += blockMatches.length;
    cleaned = cleaned.replace(blockPattern, '');
  }

  stats.commentsRemoved += removedCount;
  return cleaned;
}

/**
 * Recursively find all source files in directory
 * @param {string} dir - Directory to search
 * @param {string[]} fileList - Accumulated file list
 * @returns {string[]} - List of file paths
 */
function findSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build directories
      if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
        findSourceFiles(filePath, fileList);
      }
    } else if (stat.isFile()) {
      // Only process source files
      const ext = path.extname(file);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        // Skip test files
        if (!file.includes('.test.') && !file.includes('.spec.')) {
          fileList.push(filePath);
        }
      }
    }
  });

  return fileList;
}

/**
 * Process a single file
 * @param {string} sourceFile - Source file path
 * @param {string} sourceDir - Source directory base
 * @param {string} outputDir - Output directory base
 */
function processFile(sourceFile, sourceDir, outputDir) {
  const content = fs.readFileSync(sourceFile, 'utf8');
  const cleaned = stripComments(content);

  const relativePath = path.relative(sourceDir, sourceFile);
  const outputPath = path.join(outputDir, relativePath);

  // Create output directory if needed
  const outputDirPath = path.dirname(outputPath);
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath, { recursive: true });
  }

  // Write cleaned content
  fs.writeFileSync(outputPath, cleaned, 'utf8');

  stats.filesProcessed++;
  if (content !== cleaned) {
    stats.filesStripped++;
  }
}

/**
 * Process directory
 * @param {string} sourceDir - Source directory
 * @param {string} outputDir - Output directory
 */
function processDirectory(sourceDir, outputDir) {
  console.log(`📂 Scanning source directory: ${sourceDir}`);
  
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Error: Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  const files = findSourceFiles(sourceDir);
  console.log(`📄 Found ${files.length} source files`);

  if (files.length === 0) {
    console.error('❌ Error: No source files found');
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process each file
  files.forEach(file => {
    processFile(file, sourceDir, outputDir);
  });

  // Print summary
  console.log('\n✅ Comment stripping complete');
  console.log(`   Files processed: ${stats.filesProcessed}`);
  console.log(`   Files stripped: ${stats.filesStripped}`);
  console.log(`   Comments removed: ${stats.commentsRemoved}`);

  if (stats.filesStripped === 0) {
    console.log('\n⚠️  Warning: No comments were stripped (already clean or no instructor comments)');
  }
}

/**
 * Validate file for banned patterns (used by CI)
 * @param {string} file - File to validate
 * @returns {boolean} - True if clean, false if contains banned patterns
 */
function validateFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(content)) {
      return false;
    }
  }

  // Check for multi-line blocks
  const blockPattern = /\/\*[\s\S]*?(VULNERABLE|EXPLOIT|SPOILER|FLAG HERE|CHALLENGE HINT)[\s\S]*?\*\//gi;
  if (blockPattern.test(content)) {
    return false;
  }

  return true;
}

/**
 * Validate directory (used by CI)
 * @param {string} dir - Directory to validate
 * @returns {number} - Exit code (0 = clean, 1 = violations found)
 */
function validateDirectory(dir) {
  console.log(`🔍 Validating directory: ${dir}`);
  
  const files = findSourceFiles(dir);
  console.log(`📄 Checking ${files.length} files for instructor comments...`);

  let violations = 0;
  const violatedFiles = [];

  files.forEach(file => {
    if (!validateFile(file)) {
      violations++;
      violatedFiles.push(path.relative(dir, file));
    }
  });

  if (violations > 0) {
    console.log(`\n❌ VALIDATION FAILED: Found instructor comments in ${violations} file(s):`);
    violatedFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    return 1;
  } else {
    console.log('\n✅ VALIDATION PASSED: No instructor comments found');
    return 0;
  }
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);

  // Check for --validate flag
  if (args[0] === '--validate') {
    if (args.length < 2) {
      console.error('Usage: strip-comments.js --validate <directory>');
      process.exit(1);
    }
    const exitCode = validateDirectory(args[1]);
    process.exit(exitCode);
  }

  // Normal stripping mode
  if (args.length < 2) {
    console.error('Usage: strip-comments.js <source-dir> <output-dir>');
    console.error('   or: strip-comments.js --validate <directory>');
    process.exit(1);
  }

  const [sourceDir, outputDir] = args;

  if (!sourceDir || !outputDir) {
    console.error('❌ Error: Both source and output directories are required');
    console.error('Usage: strip-comments.js <source-dir> <output-dir>');
    process.exit(1);
  }

  if (sourceDir === outputDir) {
    console.error('❌ Error: Source and output directories must be different');
    process.exit(1);
  }

  try {
    processDirectory(sourceDir, outputDir);
    process.exit(stats.filesStripped > 0 ? 0 : 0); // Always exit 0 if successful
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  stripComments,
  validateFile,
  validateDirectory,
  BANNED_PATTERNS,
};

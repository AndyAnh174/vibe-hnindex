import { config } from '../config.js';
import type { Chunk } from '../types.js';

// Regex patterns that indicate a natural code boundary (start of a block)
const BOUNDARY_PATTERNS = [
  /^\s*(export\s+)?(default\s+)?(async\s+)?function\s/,
  /^\s*(export\s+)?(default\s+)?class\s/,
  /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,  // arrow function assignment
  /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function/,
  /^\s*def\s+\w/,                    // Python
  /^\s*(pub\s+)?(async\s+)?fn\s/,    // Rust
  /^\s*func\s/,                       // Go
  /^\s*(public|private|protected|static|override|async)\s+\w+\s*\(/,  // Java/C#/TS methods
  /^\s*interface\s/,
  /^\s*type\s+\w+\s*=/,
  /^\s*enum\s/,
  /^\s*module\s/,
  /^\s*namespace\s/,
  /^\s*impl\s/,                       // Rust
  /^\s*struct\s/,                     // Go/Rust/C
  /^\s*#\[/,                          // Rust attributes
  /^\s*@\w/,                          // Decorators
  /^\s*describe\s*\(/,               // Test blocks
  /^\s*it\s*\(/,
  /^\s*test\s*\(/,
];

function isBoundaryLine(line: string): boolean {
  return BOUNDARY_PATTERNS.some(p => p.test(line));
}

function isNaturalBreak(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === '' ||
    trimmed === '}' ||
    trimmed === '};' ||
    trimmed === '},' ||
    trimmed === 'end' ||
    trimmed === '---'  // markdown section break
  );
}

export function chunkFile(content: string, _filePath: string): Chunk[] {
  const lines = content.split('\n');
  const totalLines = lines.length;

  // Small files: single chunk
  const threshold = Math.floor(config.chunkSize * 1.3);
  if (totalLines <= threshold) {
    return [{
      content,
      startLine: 1,
      endLine: totalLines,
      chunkIndex: 0,
    }];
  }

  const chunks: Chunk[] = [];
  let currentStart = 0; // 0-based index into lines array
  let chunkIndex = 0;

  while (currentStart < totalLines) {
    const targetEnd = Math.min(currentStart + config.chunkSize, totalLines);

    // If remaining lines fit in one chunk, take them all
    if (totalLines - currentStart <= threshold) {
      const chunkLines = lines.slice(currentStart, totalLines);
      chunks.push({
        content: chunkLines.join('\n'),
        startLine: currentStart + 1, // 1-based
        endLine: totalLines,
        chunkIndex,
      });
      break;
    }

    // Look for the best split point near targetEnd (±10 lines)
    let bestSplit = targetEnd;
    const searchStart = Math.max(currentStart + Math.floor(config.chunkSize * 0.5), targetEnd - 10);
    const searchEnd = Math.min(targetEnd + 10, totalLines);

    // Priority 1: boundary line (function/class declaration) — split BEFORE it
    for (let i = searchStart; i < searchEnd; i++) {
      if (isBoundaryLine(lines[i])) {
        bestSplit = i;
        break;
      }
    }

    // Priority 2: natural break (empty line, closing brace) — split AFTER it
    if (bestSplit === targetEnd) {
      for (let i = searchEnd - 1; i >= searchStart; i--) {
        if (isNaturalBreak(lines[i])) {
          bestSplit = i + 1;
          break;
        }
      }
    }

    const chunkLines = lines.slice(currentStart, bestSplit);
    chunks.push({
      content: chunkLines.join('\n'),
      startLine: currentStart + 1, // 1-based
      endLine: bestSplit,
      chunkIndex,
    });

    // Move forward with overlap
    currentStart = Math.max(bestSplit - config.chunkOverlap, currentStart + 1);
    chunkIndex++;
  }

  return chunks;
}

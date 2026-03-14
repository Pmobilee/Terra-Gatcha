#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '../data/generated/worker-output');

async function removeVariants() {
  let filesModified = 0;
  let factsProcessed = 0;
  let variantsRemoved = 0;

  try {
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.jsonl'));

    if (files.length === 0) {
      console.log('No JSONL files found in', outputDir);
      return;
    }

    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

      const processedLines = [];
      let fileHadVariants = false;

      for (const line of lines) {
        if (!line.trim()) {
          processedLines.push(line);
          continue;
        }

        try {
          const obj = JSON.parse(line);
          factsProcessed++;

          if (obj.variants !== undefined) {
            delete obj.variants;
            variantsRemoved++;
            fileHadVariants = true;
          }

          processedLines.push(JSON.stringify(obj));
        } catch (e) {
          console.error(`Error parsing line in ${file}:`, e.message);
          processedLines.push(line);
        }
      }

      if (fileHadVariants) {
        fs.writeFileSync(filePath, processedLines.join('\n'), 'utf-8');
        filesModified++;
        console.log(`✓ ${file}`);
      } else {
        console.log(`  ${file} (no variants found)`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Files processed: ${files.length}`);
    console.log(`Files modified: ${filesModified}`);
    console.log(`Facts processed: ${factsProcessed}`);
    console.log(`Variants removed: ${variantsRemoved}`);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

removeVariants();

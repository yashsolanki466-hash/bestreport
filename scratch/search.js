import fs from 'fs';
import path from 'path';

function searchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('select-folder') || content.includes('FolderBrowser') || content.includes('powershell')) {
    console.log(`Found in: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('select-folder') || line.includes('FolderBrowser') || line.includes('powershell')) {
        console.log(`  Line ${index + 1}: ${line.trim()}`);
      }
    });
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file.startsWith('.')) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      searchFile(fullPath);
    }
  }
}

walk('.');

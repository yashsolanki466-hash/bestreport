import fs from 'fs';
import path from 'path';

const fileArg = process.argv[2] || '';
const query = process.argv[3] || '';

const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);

if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

console.log(`Searching for "${query}" in ${path.basename(filePath)}...`);

let matchesCount = 0;
lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
        console.log(`${idx + 1}: ${line.trim()}`);
        matchesCount++;
        if (matchesCount > 100) {
            console.log('... truncated ...');
            process.exit(0);
        }
    }
});

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

const files = walk(path.join(__dirname, '..', 'src'));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

console.log(`Syntax check passed for ${files.length} files.`);

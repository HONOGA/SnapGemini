const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

// Clean & recreate www
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

// Copy individual files
['index.html', 'manifest.json', 'sw.js'].forEach(file => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(wwwDir, file));
  }
});

// Copy directories
['css', 'js', 'icons'].forEach(dir => {
  const src = path.join(__dirname, dir);
  if (fs.existsSync(src)) {
    copyFolderSync(src, path.join(wwwDir, dir));
  }
});

console.log('✅ Web assets successfully copied to www/');

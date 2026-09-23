const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');
const androidAssetsDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets');
const androidPublicDir = path.join(androidAssetsDir, 'public');

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

// 1. Clean & recreate www
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

// Copy individual files to www
['index.html', 'manifest.json', 'sw.js'].forEach(file => {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(wwwDir, file));
  }
});

// Copy directories to www
['css', 'js', 'icons'].forEach(dir => {
  const src = path.join(__dirname, dir);
  if (fs.existsSync(src)) {
    copyFolderSync(src, path.join(wwwDir, dir));
  }
});

console.log('✅ Web assets successfully copied to www/');

// 2. Unconditionally sync to Android assets directory
if (!fs.existsSync(androidAssetsDir)) {
  fs.mkdirSync(androidAssetsDir, { recursive: true });
}

if (fs.existsSync(androidPublicDir)) {
  fs.rmSync(androidPublicDir, { recursive: true, force: true });
}
fs.mkdirSync(androidPublicDir, { recursive: true });

copyFolderSync(wwwDir, androidPublicDir);

const capConfigSrc = path.join(__dirname, 'capacitor.config.json');
if (fs.existsSync(capConfigSrc)) {
  fs.copyFileSync(capConfigSrc, path.join(androidAssetsDir, 'capacitor.config.json'));
}

const pluginsFile = path.join(androidAssetsDir, 'capacitor.plugins.json');
fs.writeFileSync(pluginsFile, '[]', 'utf8');

console.log('✅ Web assets unconditionally bundled into android/app/src/main/assets/public/');

const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');
const androidPublicDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public');
const androidAssetsDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets');

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

// Sync to Android assets
if (fs.existsSync(androidAssetsDir)) {
  if (fs.existsSync(androidPublicDir)) {
    fs.rmSync(androidPublicDir, { recursive: true, force: true });
  }
  copyFolderSync(wwwDir, androidPublicDir);

  const capConfigSrc = path.join(__dirname, 'capacitor.config.json');
  if (fs.existsSync(capConfigSrc)) {
    fs.copyFileSync(capConfigSrc, path.join(androidAssetsDir, 'capacitor.config.json'));
  }
  const pluginsFile = path.join(androidAssetsDir, 'capacitor.plugins.json');
  if (!fs.existsSync(pluginsFile)) {
    fs.writeFileSync(pluginsFile, '[]', 'utf8');
  }
  console.log('✅ Web assets synced directly to Android assets!');
}

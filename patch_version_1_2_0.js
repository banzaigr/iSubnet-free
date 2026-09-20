const fs = require('fs');

// 1. app.js
let appjs = fs.readFileSync('app.js', 'utf8');
appjs = appjs.split('\r\n').join('\n');
const e1Find = `      if (id === 'ipv6-address' || id === 'split-base-ip' || id === 'ipv6-bulk-input') {
        collapseDuplicateColons(el);
      }`;
const e1Rep = `      if (id === 'ipv6-address' || id === 'split-base-ip' || id === 'ipv4-bulk-input' || id === 'ipv6-bulk-input') {
        collapseDuplicateColons(el);
      }`;
if (appjs.includes(e1Find)) {
    appjs = appjs.replace(e1Find, e1Rep);
    console.log("Applied Edit 1 to app.js");
} else { console.error("Failed Edit 1 to app.js"); }
fs.writeFileSync('app.js', appjs);

// 2. build.gradle
let gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
gradle = gradle.replace('versionName "1.1.18"', 'versionName "1.2.0"');
gradle = gradle.replace('versionCode 100', 'versionCode 101');
fs.writeFileSync('android/app/build.gradle', gradle);
console.log("Updated build.gradle");

// 3. project.pbxproj
let pbx = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
pbx = pbx.split('MARKETING_VERSION = 1.1.18;').join('MARKETING_VERSION = 1.2.0;');
pbx = pbx.split('CURRENT_PROJECT_VERSION = 100;').join('CURRENT_PROJECT_VERSION = 101;');
fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', pbx);
console.log("Updated project.pbxproj");

// 4. package.json
let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace('"version": "1.1.18",', '"version": "1.2.0",');
fs.writeFileSync('package.json', pkg);
console.log("Updated package.json");

// 5. index.html
let idx = fs.readFileSync('index.html', 'utf8');
idx = idx.replace('iSubnet v1.1.18 (Build 100)', 'iSubnet v1.2.0 (Build 101)');
fs.writeFileSync('index.html', idx);
console.log("Updated index.html");

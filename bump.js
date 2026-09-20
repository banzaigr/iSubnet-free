const fs = require('fs');

let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '1.1.18';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

let index = fs.readFileSync('index.html', 'utf8');
index = index.replace('Build 91', 'Build 92');
fs.writeFileSync('index.html', index);

let gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
gradle = gradle.replace('versionName "1.1.17"', 'versionName "1.1.18"');
gradle = gradle.replace('versionCode 91', 'versionCode 92');
fs.writeFileSync('android/app/build.gradle', gradle);

let pbxproj = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
pbxproj = pbxproj.split('MARKETING_VERSION = 1.1.17;').join('MARKETING_VERSION = 1.1.18;');
pbxproj = pbxproj.split('CURRENT_PROJECT_VERSION = 91;').join('CURRENT_PROJECT_VERSION = 92;');
fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', pbxproj);

console.log('Bumped marketing version to 1.1.18 and build version to 92!');

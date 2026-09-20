const fs = require('fs');

let appjs = fs.readFileSync('app.js', 'utf8');
// Normalize line endings for reliable matching on Windows
appjs = appjs.split('\r\n').join('\n');

// Edit 1
const e1Find = `  const triggerPDFExport = async (type) => {
    if (!PRO_UNLOCKED) {
      showProModal();
      return;
    }

    const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
    if (isNative) {
      try {
        const reportText = getReportText(type);
        const { Filesystem, Share } = window.Capacitor.Plugins;
        const filename = \`isubnet_report_\${type}.txt\`;
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: reportText,
          directory: 'CACHE',
          encoding: 'utf8'
        });
        await Share.share({
          title: 'Export Report',
          url: writeResult.uri
        });
      } catch (err) {
        console.error("Capacitor Report Export failed:", err);
        showErrorDialog("Export failed: " + err.message);
      }
    } else {
      window.print();
    }
  };`;

const e1Rep = `  const triggerPDFExport = async (type) => {
    if (!PRO_UNLOCKED) {
      showProModal();
      return;
    }

    const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
    if (isNative) {
      const reportText = getReportText(type);
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const filename = \`isubnet_report_\${type}.txt\`;
      let writeResult;
      try {
        writeResult = await Filesystem.writeFile({
          path: filename,
          data: reportText,
          directory: 'CACHE',
          encoding: 'utf8'
        });
      } catch (err) {
        console.error("Capacitor Report Export failed (file write):", err);
        showErrorDialog("Export failed: " + err.message);
        return;
      }
      try {
        await Share.share({
          title: 'Export Report',
          url: writeResult.uri
        });
      } catch (err) {
        // Android's Capacitor Share plugin can reject this promise even when the
        // OS share sheet was already shown and the user genuinely shared or saved
        // the file - the chooser intent doesn't always report its result back to
        // the calling activity reliably (same quirk fixed in shareText()). The
        // file itself was already written successfully at this point, so we just
        // log this and don't show a misleading "Export failed" dialog after a
        // real export.
        console.error("Capacitor Report Export share step failed/rejected:", err);
      }
    } else {
      window.print();
    }
  };`;

// Edit 2
const e2Find = `async function downloadCSV(filename, content) {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const { Filesystem, Share } = window.Capacitor.Plugins;
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'CACHE',
        encoding: 'utf8'
      });
      await Share.share({
        title: 'Export CSV',
        url: writeResult.uri
      });
      return;
    } catch (err) {
      console.error("Capacitor CSV Export failed:", err);
      showErrorDialog("Export failed: " + err.message);
      return;
    }
  }`;

const e2Rep = `async function downloadCSV(filename, content) {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  if (isNative) {
    const { Filesystem, Share } = window.Capacitor.Plugins;
    let writeResult;
    try {
      writeResult = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'CACHE',
        encoding: 'utf8'
      });
    } catch (err) {
      console.error("Capacitor CSV Export failed (file write):", err);
      showErrorDialog("Export failed: " + err.message);
      return;
    }
    try {
      await Share.share({
        title: 'Export CSV',
        url: writeResult.uri
      });
    } catch (err) {
      // Same Android Share-plugin quirk as triggerPDFExport()/shareText(): the
      // promise can reject even after a successful share/save, so don't show a
      // misleading "Export failed" dialog once the file itself has already been
      // written successfully.
      console.error("Capacitor CSV Export share step failed/rejected:", err);
    }
    return;
  }`;

if (appjs.includes(e1Find)) {
  appjs = appjs.replace(e1Find, e1Rep);
  console.log("Applied Edit 1");
} else {
  console.error("Failed to apply Edit 1");
}

if (appjs.includes(e2Find)) {
  appjs = appjs.replace(e2Find, e2Rep);
  console.log("Applied Edit 2");
} else {
  console.error("Failed to apply Edit 2");
}

fs.writeFileSync('app.js', appjs);

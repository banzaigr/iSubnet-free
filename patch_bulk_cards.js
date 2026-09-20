const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.split('\r\n').join('\n');

let appjs = fs.readFileSync('app.js', 'utf8');
appjs = appjs.split('\r\n').join('\n');

// Edit 1
const e1Find = `        <!-- Bulk Results Card -->
        <div class="card result-card hidden" id="ipv4-bulk-results">
          <div class="result-header" style="margin-bottom: 12px;">
            <h3>Bulk Subnet Results</h3>
            <div style="display: flex; gap: 8px;">
              <button id="btn-export-pdf-bulk-ipv4" class="btn-action pro-feature-btn" data-pro="true" style="font-size: 11px; padding: 4px 8px;">Report</button>
              <button id="btn-export-csv-bulk-ipv4" class="btn-action pro-feature-btn" data-pro="true" style="font-size: 11px; padding: 4px 8px;">CSV</button>
            </div>
          </div>
          <div class="table-container" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                  <th style="padding: 8px 4px;">Input IP</th>
                  <th style="padding: 8px 4px;">Network / Range</th>
                  <th style="padding: 8px 4px;">Hosts / Addresses</th>
                </tr>
              </thead>
              <tbody id="ipv4-bulk-results-tbody">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
        </div>`;

const e1Rep = `        <!-- Bulk Results Card -->
        <div class="card result-card hidden" id="ipv4-bulk-results">
          <div class="result-header" style="margin-bottom: 12px;">
            <h3>Bulk Subnet Results</h3>
          </div>
          <div class="table-container" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                  <th style="padding: 8px 4px;">Input IP</th>
                  <th style="padding: 8px 4px;">Network / Range</th>
                  <th style="padding: 8px 4px;">Hosts / Addresses</th>
                </tr>
              </thead>
              <tbody id="ipv4-bulk-results-tbody">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
          <div class="result-actions" style="display: flex; gap: 8px; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; width: 100%;">
            <button id="btn-export-pdf-bulk-ipv4" class="btn-action pro-feature-btn" data-pro="true" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>
              <span>Report</span>
            </button>
            <button id="btn-export-csv-bulk-ipv4" class="btn-action pro-feature-btn" data-pro="true" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>
              <span>CSV</span>
            </button>
            <button id="btn-save-notes-bulk-ipv4" class="btn-action" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              <span>Save</span>
            </button>
            <button id="btn-share-bulk-ipv4" class="btn-action" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
              <span>Share</span>
            </button>
          </div>
        </div>`;

// Edit 2
const e2Find = `        <!-- Bulk Results Card IPv6 -->
        <div class="card result-card hidden" id="ipv6-bulk-results">
          <div class="result-header" style="margin-bottom: 12px;">
            <h3>Bulk Subnet Results (IPv6)</h3>
            <div style="display: flex; gap: 8px;">
              <button id="btn-export-pdf-bulk-ipv6" class="btn-action pro-feature-btn" data-pro="true" style="font-size: 11px; padding: 4px 8px;">Report</button>
              <button id="btn-export-csv-bulk-ipv6" class="btn-action pro-feature-btn" data-pro="true" style="font-size: 11px; padding: 4px 8px;">CSV</button>
            </div>
          </div>
          <div class="table-container" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                  <th style="padding: 8px 4px;">Input IP</th>
                  <th style="padding: 8px 4px;">Prefix / Range</th>
                  <th style="padding: 8px 4px;">Hosts / Addresses</th>
                </tr>
              </thead>
              <tbody id="ipv6-bulk-results-tbody">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
        </div>`;

const e2Rep = `        <!-- Bulk Results Card IPv6 -->
        <div class="card result-card hidden" id="ipv6-bulk-results">
          <div class="result-header" style="margin-bottom: 12px;">
            <h3>Bulk Subnet Results (IPv6)</h3>
          </div>
          <div class="table-container" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                  <th style="padding: 8px 4px;">Input IP</th>
                  <th style="padding: 8px 4px;">Prefix / Range</th>
                  <th style="padding: 8px 4px;">Hosts / Addresses</th>
                </tr>
              </thead>
              <tbody id="ipv6-bulk-results-tbody">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
          <div class="result-actions" style="display: flex; gap: 8px; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; width: 100%;">
            <button id="btn-export-pdf-bulk-ipv6" class="btn-action pro-feature-btn" data-pro="true" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>
              <span>Report</span>
            </button>
            <button id="btn-export-csv-bulk-ipv6" class="btn-action pro-feature-btn" data-pro="true" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>
              <span>CSV</span>
            </button>
            <button id="btn-save-notes-bulk-ipv6" class="btn-action" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              <span>Save</span>
            </button>
            <button id="btn-share-bulk-ipv6" class="btn-action" style="flex: 1; padding: 6px 4px; font-size: 12px; display: flex; justify-content: center; gap: 4px;">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
              <span>Share</span>
            </button>
          </div>
        </div>`;

// Edit 3
const e3Find = `  csvIds.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        triggerCSVDownload(item.type);
      });
    }
  });
}`;

const e3Rep = `  csvIds.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        triggerCSVDownload(item.type);
      });
    }
  });

  // Bulk IPv4/IPv6 results don't have their own note/share text builders - they
  // reuse getReportText(), the same formatted-text helper the Report export
  // above already uses for these same 'bulk-ipv4'/'bulk-ipv6' types, so Save
  // and Share always show exactly what Report/CSV show.
  const btnSaveNotesBulkIpv4 = document.getElementById('btn-save-notes-bulk-ipv4');
  if (btnSaveNotesBulkIpv4) {
    btnSaveNotesBulkIpv4.addEventListener('click', () => {
      const content = getReportText('bulk-ipv4');
      addNote('Bulk IPv4 Subnet Results', content, 'IPv4');
      maybeRequestReview('save_note');
      switchToNotesTab();
    });
  }
  const btnShareBulkIpv4 = document.getElementById('btn-share-bulk-ipv4');
  if (btnShareBulkIpv4) {
    btnShareBulkIpv4.addEventListener('click', () => {
      shareText('Bulk IPv4 Subnet Results', getReportText('bulk-ipv4'));
    });
  }

  const btnSaveNotesBulkIpv6 = document.getElementById('btn-save-notes-bulk-ipv6');
  if (btnSaveNotesBulkIpv6) {
    btnSaveNotesBulkIpv6.addEventListener('click', () => {
      const content = getReportText('bulk-ipv6');
      addNote('Bulk IPv6 Subnet Results', content, 'IPv6');
      maybeRequestReview('save_note');
      switchToNotesTab();
    });
  }
  const btnShareBulkIpv6 = document.getElementById('btn-share-bulk-ipv6');
  if (btnShareBulkIpv6) {
    btnShareBulkIpv6.addEventListener('click', () => {
      shareText('Bulk IPv6 Subnet Results', getReportText('bulk-ipv6'));
    });
  }
}`;

if (indexHtml.includes(e1Find)) {
    indexHtml = indexHtml.replace(e1Find, e1Rep);
    console.log("Applied Edit 1");
} else {
    console.log("Failed Edit 1");
}

if (indexHtml.includes(e2Find)) {
    indexHtml = indexHtml.replace(e2Find, e2Rep);
    console.log("Applied Edit 2");
} else {
    console.log("Failed Edit 2");
}

if (appjs.includes(e3Find)) {
    appjs = appjs.replace(e3Find, e3Rep);
    console.log("Applied Edit 3");
} else {
    console.log("Failed Edit 3");
}

fs.writeFileSync('index.html', indexHtml);
fs.writeFileSync('app.js', appjs);

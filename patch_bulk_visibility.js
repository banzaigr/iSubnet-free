const fs = require('fs');

let appjs = fs.readFileSync('app.js', 'utf8');
// Normalize line endings for reliable matching on Windows
appjs = appjs.split('\r\n').join('\n');

// Edit 1
const e1Find = `      tbody.appendChild(tr);
    }
  });

  if (hasValid) {
    card.classList.remove('hidden');
  }
}
function calculateBulkIPv6() {`;

const e1Rep = `      tbody.appendChild(tr);
    }
  });

  if (lines.length > 0) {
    card.classList.remove('hidden');
  }
}
function calculateBulkIPv6() {`;

// Edit 2
const e2Find = `      tbody.appendChild(tr);
    }
  });

  if (hasValid) {
    card.classList.remove('hidden');
  }
}

// --- CSV/PDF REPORT EXPORTER ---`;

const e2Rep = `      tbody.appendChild(tr);
    }
  });

  if (lines.length > 0) {
    card.classList.remove('hidden');
  }
}

// --- CSV/PDF REPORT EXPORTER ---`;

if (appjs.includes(e1Find)) {
    appjs = appjs.replace(e1Find, e1Rep);
    console.log("Applied Edit 1");
} else {
    console.log("Failed Edit 1");
}

if (appjs.includes(e2Find)) {
    appjs = appjs.replace(e2Find, e2Rep);
    console.log("Applied Edit 2");
} else {
    console.log("Failed Edit 2");
}

fs.writeFileSync('app.js', appjs);

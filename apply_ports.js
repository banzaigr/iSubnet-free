const fs = require('fs');

// 1. styles.css
let css = fs.readFileSync('styles.css', 'utf8');
const cssAddition = `
.ref-ports-scroll {
  max-height: 400px;
  overflow-y: auto;
}

.ref-ports-scroll::-webkit-scrollbar {
  width: 4px;
}

.ref-ports-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.ref-ports-scroll thead th {
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
}`;

css = css.replace(
  `.list-val {\n  font-family: monospace;\n  color: var(--accent-primary);\n}`,
  `.list-val {\n  font-family: monospace;\n  color: var(--accent-primary);\n}` + cssAddition
);
fs.writeFileSync('styles.css', css);


// 2. index.html
let html = fs.readFileSync('index.html', 'utf8');
const htmlAddition = `
        <div class="card ref-card">
          <h2 class="card-title">Common Ports</h2>
          <div class="table-container ref-ports-scroll">
            <table>
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Service</th>
                  <th style="text-align: right;">Protocol</th>
                </tr>
              </thead>
              <tbody>
                <tr class="highlight-row"><td>20</td><td>FTP (Data)</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>21</td><td>FTP (Control)</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>22</td><td>SSH</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>23</td><td>Telnet</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>25</td><td>SMTP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>43</td><td>WHOIS</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>53</td><td>DNS</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP/UDP</td></tr>
                <tr><td>67</td><td>DHCP (Server)</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr class="highlight-row"><td>68</td><td>DHCP (Client)</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr><td>69</td><td>TFTP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr class="highlight-row"><td>80</td><td>HTTP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>110</td><td>POP3</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>119</td><td>NNTP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>123</td><td>NTP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr class="highlight-row"><td>143</td><td>IMAP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>161</td><td>SNMP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr class="highlight-row"><td>162</td><td>SNMP Trap</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr><td>179</td><td>BGP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>389</td><td>LDAP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>443</td><td>HTTPS</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>445</td><td>SMB</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>465</td><td>SMTPS</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>514</td><td>Syslog</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr><td>587</td><td>SMTP (Submission)</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>636</td><td>LDAPS</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>993</td><td>IMAPS</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>995</td><td>POP3S</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>1433</td><td>Microsoft SQL Server</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>1521</td><td>Oracle DB</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>3306</td><td>MySQL</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>3389</td><td>RDP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>5060</td><td>SIP</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">UDP</td></tr>
                <tr class="highlight-row"><td>5061</td><td>SIP (TLS)</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>5432</td><td>PostgreSQL</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>5900</td><td>VNC</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>6379</td><td>Redis</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr class="highlight-row"><td>8080</td><td>HTTP Proxy / Alt</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
                <tr><td>8443</td><td>HTTPS Alt</td><td class="ref-table-accent" style="text-align: right; font-family: monospace; font-size: 13px;">TCP</td></tr>
              </tbody>
            </table>
          </div>
          <div class="result-actions" style="display: flex; gap: 15px; justify-content: flex-end; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
            <button id="btn-copy-ref-ports" class="btn-action">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              <span>Copy</span>
            </button>
            <button id="btn-share-ref-ports" class="btn-action">
              <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
              <span>Share</span>
            </button>
          </div>
        </div>`;

html = html.replace(
  `              <span>Share</span>\n            </button>\n          </div>\n        </div>`,
  `              <span>Share</span>\n            </button>\n          </div>\n        </div>` + htmlAddition
);
fs.writeFileSync('index.html', html);


// 3. app.js
let appjs = fs.readFileSync('app.js', 'utf8');
const textConstant = `\n\nconst refPortsText = \`Common Ports Reference:
- 20: FTP (Data) - TCP
- 21: FTP (Control) - TCP
- 22: SSH - TCP
- 23: Telnet - TCP
- 25: SMTP - TCP
- 43: WHOIS - TCP
- 53: DNS - TCP/UDP
- 67: DHCP (Server) - UDP
- 68: DHCP (Client) - UDP
- 69: TFTP - UDP
- 80: HTTP - TCP
- 110: POP3 - TCP
- 119: NNTP - TCP
- 123: NTP - UDP
- 143: IMAP - TCP
- 161: SNMP - UDP
- 162: SNMP Trap - UDP
- 179: BGP - TCP
- 389: LDAP - TCP
- 443: HTTPS - TCP
- 445: SMB - TCP
- 465: SMTPS - TCP
- 514: Syslog - UDP
- 587: SMTP (Submission) - TCP
- 636: LDAPS - TCP
- 993: IMAPS - TCP
- 995: POP3S - TCP
- 1433: Microsoft SQL Server - TCP
- 1521: Oracle DB - TCP
- 3306: MySQL - TCP
- 3389: RDP - TCP
- 5060: SIP - UDP
- 5061: SIP (TLS) - TCP
- 5432: PostgreSQL - TCP
- 5900: VNC - TCP
- 6379: Redis - TCP
- 8080: HTTP Proxy / Alt - TCP
- 8443: HTTPS Alt - TCP\`;`;

appjs = appjs.replace(
  `- RFC 5952 Canonical: 2001:db8:0:0:1::\`;`,
  `- RFC 5952 Canonical: 2001:db8:0:0:1::\`;` + textConstant
);

const shareFunction = `\nfunction shareRefPorts() {\n  shareText('Common Ports', refPortsText);\n}`;
appjs = appjs.replace(
  `function shareRefIpv6() {\n  shareText('IPv6 Address Types', refIpv6Text);\n}`,
  `function shareRefIpv6() {\n  shareText('IPv6 Address Types', refIpv6Text);\n}` + shareFunction
);

const eventListeners = `\n  const btnCopyRefPorts = document.getElementById('btn-copy-ref-ports');
  if (btnCopyRefPorts) {
    btnCopyRefPorts.addEventListener('click', () => copyTextWithToast('btn-copy-ref-ports', refPortsText));
  }
  const btnShareRefPorts = document.getElementById('btn-share-ref-ports');
  if (btnShareRefPorts) btnShareRefPorts.addEventListener('click', shareRefPorts);`;

appjs = appjs.replace(
  `document.getElementById('btn-share-ref-compression').addEventListener('click', shareRefCompression);`,
  `document.getElementById('btn-share-ref-compression').addEventListener('click', shareRefCompression);` + eventListeners
);
fs.writeFileSync('app.js', appjs);
console.log('Applied patch successfully!');

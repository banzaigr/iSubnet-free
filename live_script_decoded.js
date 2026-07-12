
(function() {
  'use strict';
  function getStorageItem(key, defaultValue) {
    try { return localStorage.getItem(key) || defaultValue; } catch(e) { return defaultValue; }
  }
  function setStorageItem(key, value) {
    try { localStorage.setItem(key, value); } catch(e) {}
  }
  function getDefaultTheme() {
    const saved = getStorageItem('isubnet_landing_theme', null);
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    const btn = document.getElementById('isubnet-theme-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    applyAstraBackgroundOverride(isDark);
  }
  window.toggleTheme = function() {
    const isDark = document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('isubnet-theme-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    setStorageItem('isubnet_landing_theme', isDark ? 'dark' : 'light');
    applyAstraBackgroundOverride(isDark);
  };
  function applyAstraBackgroundOverride(isDark) {
    const bg = isDark ? '#090d16' : '#ffffff';
    document.querySelectorAll(
      '.ast-plain-container,.ast-container,.site,.site-content,.entry-content,.post-inner,#primary,#main'
    ).forEach(el => {
      el.style.setProperty('background-color', bg, 'important');
      el.style.setProperty('background', bg, 'important');
    });
  }
  function initAll() {
    const isDark = getDefaultTheme() === 'dark';
    applyTheme(isDark);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  setTimeout(initAll, 500);

  var PG_ACCENT = '#4f46e5';
  var PG_ACCENT_RGB = '79,70,229';

  function hexToRgb(hex){
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? parseInt(m[1],16)+','+parseInt(m[2],16)+','+parseInt(m[3],16) : '79,70,229';
  }

  function computeBitOff(hex){
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if(!m) return 'hsl(205,25%,50%)';
    var r=parseInt(m[1],16)/255,g=parseInt(m[2],16)/255,b=parseInt(m[3],16)/255;
    var max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2,h=0,s=0;
    if(d){
      s=d/(1-Math.abs(2*l-1));
      if(max===r) h=((g-b)/d+6)%6;
      else if(max===g) h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h=Math.round(h*60);
    }
    var offH=(h+165)%360;
    var offS=Math.max(10,Math.min(Math.round(s*100),35));
    var offL=l>0.55?30:68;
    return 'hsl('+offH+','+offS+'%,'+offL+'%)';
  }

  window.pgSetAccent = function(color, el){
    PG_ACCENT = color;
    PG_ACCENT_RGB = hexToRgb(color);
    var root = document.querySelector('.isub-pg') || document.documentElement;
    root.style.setProperty('--pg-accent', color);
    root.style.setProperty('--pg-accent-rgb', PG_ACCENT_RGB);
    root.style.setProperty('--bit-on', color);
    root.style.setProperty('--bit-off', computeBitOff(color));
    document.querySelectorAll('.isub-pg__tab.is-active').forEach(function(t){
      t.style.background=color; t.style.borderColor=color;
    });
    document.querySelectorAll('.isub-pg__dot').forEach(function(d){ d.classList.remove('is-active'); });
    if(el) el.classList.add('is-active');
    pgV4Calc(); pgV6Calc(); pgConvRun();
    try{ localStorage.setItem('isub_pg_accent',color); }catch(e){}
  };

  window.pgTab = function(name, btnEl){
    document.querySelectorAll('.isub-pg__panel').forEach(function(p){ p.classList.remove('is-active'); });
    document.querySelectorAll('.isub-pg__tab').forEach(function(b){
      b.classList.remove('is-active');
      b.style.background=''; b.style.borderColor=''; b.style.color='';
    });
    var panel = document.getElementById('pg-panel-'+name);
    if(panel) panel.classList.add('is-active');
    if(btnEl){
      btnEl.classList.add('is-active');
      btnEl.style.background=PG_ACCENT;
      btnEl.style.borderColor=PG_ACCENT;
      btnEl.style.color='#fff';
    }
  };

  function v4ok(ip){
    var p=ip.split('.'); if(p.length!==4) return false;
    for(var i=0;i<4;i++){ var n=Number(p[i]); if(p[i].trim()===''||isNaN(n)||n<0||n>255) return false; }
    return true;
  }
  function ip2u32(ip){ return ip.split('.').reduce(function(a,o){ return (a<<8)+parseInt(o,10); },0)>>>0; }
  function u32ip(v){ return [(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255].join('.'); }
  function u32bin(v){
    var b=v.toString(2).padStart(32,'0');
    return b.slice(0,8)+'.'+b.slice(8,16)+'.'+b.slice(16,24)+'.'+b.slice(24);
  }
  function cidrMask(c){ return c===0?0:(~0<<(32-c))>>>0; }

  function colorBinStr(dotted){
    return dotted.split('').map(function(ch){
      if(ch==='1') return '<span class="b1">1</span>';
      if(ch==='0') return '<span class="b0">0</span>';
      return '<span class="bdot">.</span>';
    }).join('');
  }

  window.pgV4Calc = function(){
    var ip=(document.getElementById('pg-v4-ip')||{}).value||'';
    ip=ip.trim();
    var cidrEl=document.getElementById('pg-v4-cidr');
    var cidr=cidrEl?parseInt(cidrEl.value,10):24;
    var errEl=document.getElementById('pg-v4-err');
    var lbl=document.getElementById('pg-v4-cidr-lbl');

    if(lbl) lbl.textContent='/'+cidr;
    if(errEl) errEl.textContent='';

    if(!v4ok(ip)){
      if(errEl&&ip.length>6) errEl.textContent='Invalid IPv4 address';
      return;
    }

    var ipv=ip2u32(ip);
    var mv=cidrMask(cidr);
    var wv=(~mv)>>>0;
    var nv=(ipv&mv)>>>0;
    var bv=(ipv|wv)>>>0;

    var fo=(ipv>>>24)&255;
    var cls='Unknown';
    if(fo>=1&&fo<=126) cls='Class A';
    else if(fo===127) cls='Class A (Loopback)';
    else if(fo>=128&&fo<=191) cls='Class B';
    else if(fo>=192&&fo<=223) cls='Class C';
    else if(fo>=224&&fo<=239) cls='Class D (Multicast)';
    else if(fo>=240) cls='Class E (Research)';

    var typ='Public IP';
    if(fo===10) typ='Private (RFC1918 /8)';
    else if(fo===172&&((ipv>>>16)&255)>=16&&((ipv>>>16)&255)<=31) typ='Private (RFC1918 /12)';
    else if(fo===192&#038;&#038;((ipv>>>16)&255)===168) typ='Private (RFC1918 /16)';
    else if(fo===127) typ='Loopback';
    else if(fo===169&&((ipv>>>16)&255)===254) typ='Link-Local (APIPA)';

    var hosts, rStart, rEnd;
    if(cidr===32){ hosts=1; rStart=u32ip(nv); rEnd=u32ip(nv); }
    else if(cidr===31){ hosts=2; rStart=u32ip(nv); rEnd=u32ip(bv); }
    else{ hosts=Math.pow(2,32-cidr)-2; rStart=u32ip(nv+1); rEnd=u32ip(bv-1); }

    function set(id,val){ var e=document.getElementById(id); if(e) e.textContent=val; }
    function html(id,val){ var e=document.getElementById(id); if(e) e.innerHTML=val; }

    set('pg-v4-cidr-out', u32ip(nv)+'/'+cidr);
    set('pg-v4-mask',     u32ip(mv));
    set('pg-v4-wild',     u32ip(wv));
    set('pg-v4-net',      u32ip(nv));
    set('pg-v4-bcast',    u32ip(bv));
    set('pg-v4-hosts',    hosts.toLocaleString());
    set('pg-v4-range',    rStart+' – '+rEnd);
    set('pg-v4-class',    cls);
    set('pg-v4-type',     typ);
    html('pg-v4-binip',   colorBinStr(u32bin(ipv)));
    html('pg-v4-binmask', colorBinStr(u32bin(mv)));
  };

  function v6parse(s){
    s=s.trim().toLowerCase();
    if(!s||!/^[0-9a-f:]+$/i.test(s)) return null;
    if(s.includes(':::')||s.split('::').length>2) return null;
    var parts=[];
    if(s.includes('::')){
      var lr=s.split('::');
      var L=lr[0]?lr[0].split(':'):[];
      var R=lr[1]?lr[1].split(':'):[];
      var miss=8-(L.length+R.length);
      if(miss<0) return null;
      parts=L.concat(Array(miss).fill('0'),R);
    } else { parts=s.split(':'); }
    if(parts.length!==8) return null;
    var bi=BigInt(0);
    for(var i=0;i<8;i++){
      var v=parseInt(parts[i]||'0',16);
      if(isNaN(v)||v<0||v>0xffff) return null;
      bi=(bi<<BigInt(16))+BigInt(v);
    }
    return bi;
  }

  function v6expand(bi){
    var p=[]; var t=bi;
    for(var i=0;i<8;i++){ p.unshift(Number(t&#038;BigInt(0xffff)).toString(16).padStart(4,'0')); t=t>>BigInt(16); }
    return p.join(':');
  }

  function v6compress(bi){
    var p=[]; var t=bi;
    for(var i=0;i<8;i++){ p.unshift(Number(t&#038;BigInt(0xffff)).toString(16)); t=t>>BigInt(16); }
    var mxS=-1,mxL=0,cS=-1,cL=0;
    for(var j=0;j<8;j++){
      if(p[j]==='0'){ if(cS===-1) cS=j; cL++;
        if(cL>mxL){ mxL=cL; mxS=cS; }
      } else { cS=-1; cL=0; }
    }
    if(mxL>1){
      var lt=p.slice(0,mxS).join(':'), rt=p.slice(mxS+mxL).join(':');
      return (lt?lt:'')+'::'+( rt?rt:'');
    }
    return p.join(':');
  }

  function colorV6Expanded(bi, prefix){
    var groups=[]; var t=bi;
    for(var i=0;i<8;i++){ groups.unshift(Number(t&#038;BigInt(0xffff)).toString(16).padStart(4,'0')); t=t>>BigInt(16); }
    var fullActive=Math.floor(prefix/16);
    var partIdx=fullActive;
    var activeNibbles=Math.ceil((prefix%16)/4);
    var dot='<span class="bdot">:</span>';

    return groups.map(function(g,idx){
      var active= idx<fullActive ? 4 : (idx===partIdx&#038;&#038;prefix%16!==0 ? activeNibbles : 0);
      return g.split('').map(function(ch,n){
        return '<span class="'+(n<active?'b1':'b0')+'">'+ch+'</span>';
      }).join('');
    }).join(dot);
  }

  function colorV6Boundary(bi, prefix){
    var groups=[]; var t=bi;
    for(var i=0;i<8;i++){ groups.unshift(Number(t&#038;BigInt(0xffff)).toString(16).padStart(4,'0')); t=t>>BigInt(16); }
    var fullActive=Math.floor(prefix/16);
    var partIdx=fullActive;
    var activeBits=prefix%16;
    var dot='<span class="bdot">:</span>';

    var parts = groups.map(function(g, i){
      if(i === partIdx){
        var val = parseInt(g, 16);
        var binStr = val.toString(2).padStart(16, '0');
        return binStr.split('').map(function(bit, n){
          var cls = n < activeBits ? 'b1' : 'b0';
          return '<span class="'+cls+'">'+bit+'</span>';
        }).join('');
      } else {
        var activeCount = i < fullActive ? 4 : 0;
        return g.split('').map(function(ch, n){
          var cls = n < activeCount ? 'b1' : 'b0';
          return '<span class="'+cls+'">'+ch+'</span>';
        }).join('');
      }
    });
    return parts.join(dot);
  }

  function colorV6Compressed(bi, prefix){
    var comp = v6compress(bi);
    var groups = comp.split(':');
    var fullGroups=[]; var t=bi;
    for(var i=0;i<8;i++){ fullGroups.unshift(Number(t&#038;BigInt(0xffff)).toString(16).padStart(4,'0')); t=t>>BigInt(16); }
    var fullActive=Math.floor(prefix/16);
    var partIdx=fullActive;
    var activeNibbles=Math.ceil((prefix%16)/4);
    var dot='<span class="bdot">:</span>';

    var reconstructedGroups = [];
    var fullIdx = 0;

    for (var k = 0; k < groups.length; k++) {
      var g = groups[k];
      if (g === '') {
        var emptyCount = 8 - (groups.length - 1);
        if (k === 0 || k === groups.length - 1) { emptyCount = 8 - (groups.filter(x => x !== '').length); }
        reconstructedGroups.push('<span class="bdot">::</span>');
        fullIdx += emptyCount;
        if(k===0 && groups[1]==='') k++;
      } else {
        var fullHex = fullGroups[fullIdx];
        var activeCount = fullIdx < fullActive ? 4 : (fullIdx === partIdx &#038;&#038; prefix % 16 !== 0 ? activeNibbles : 0);
        var padded = fullHex.padStart(4, '0');
        var html = '';
        for (var n = 0; n < padded.length; n++) {
          var cls = n < activeCount ? 'b1' : 'b0';
          html += '<span class="'+cls+'">'+padded[n]+'</span>';
        }
        var leadingZeros = 4 - g.length;
        if (leadingZeros > 0) {
          for (var lz = 0; lz < leadingZeros; lz++) {
            html = html.replace(/^<span class="[^"]+">0<\/span>/, '');
          }
        }
        reconstructedGroups.push(html);
        fullIdx++;
      }
    }
    
    var outputHtml = '';
    for(var m=0; m<reconstructedGroups.length; m++) {
      outputHtml += reconstructedGroups[m];
      if (m < reconstructedGroups.length - 1 &#038;&#038; reconstructedGroups[m] !== '<span class="bdot">::</span>' && reconstructedGroups[m+1] !== '<span class="bdot">::</span>') {
        outputHtml += dot;
      }
    }
    return outputHtml;
  }

  window.pgV6Calc = function(){
    var ipVal=(document.getElementById('pg-v6-ip')||{}).value||'';
    ipVal=ipVal.trim();
    var cidrEl=document.getElementById('pg-v6-cidr');
    var cidr=cidrEl?parseInt(cidrEl.value,10):64;
    var errEl=document.getElementById('pg-v6-err');
    var lbl=document.getElementById('pg-v6-cidr-lbl');

    if(lbl) lbl.textContent='/'+cidr;
    if(errEl) errEl.textContent='';

    var bi = v6parse(ipVal);
    if(bi === null){
      if(errEl&&ipVal.length>4) errEl.textContent='Invalid IPv6 address';
      return;
    }

    var hostMask = (BigInt(1) << BigInt(128 - cidr)) - BigInt(1);
    var netMask = ~hostMask &#038; ((BigInt(1) << BigInt(128)) - BigInt(1));
    var networkVal = bi &#038; netMask;
    var broadcastVal = networkVal | hostMask;
    var totalAddresses = BigInt(2) ** BigInt(128 - cidr);

    function set(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
    function html(id,v){ var e=document.getElementById(id); if(e) e.innerHTML=v; }

    html('pg-v6-compressed', colorV6Compressed(bi, cidr));
    html('pg-v6-expanded',   colorV6Expanded(bi, cidr));
    set('pg-v6-prefix',      '/'+cidr);
    html('pg-v6-netprefix',  colorV6Compressed(networkVal, cidr) + '<span class="bdot">/</span><span class="b1">'+cidr+'</span>');
    html('pg-v6-start',      colorV6Compressed(networkVal, cidr));
    html('pg-v6-end',        colorV6Compressed(broadcastVal, cidr));
    set('pg-v6-total',       totalAddresses.toLocaleString());

    var boundaryRow = document.getElementById('pg-v6-boundary-row');
    if (boundaryRow) {
      if (cidr % 16 !== 0) {
        html('pg-v6-boundary', colorV6Boundary(bi, cidr));
        boundaryRow.style.display = '';
      } else {
        boundaryRow.style.display = 'none';
      }
    }
  };

  var currentSpMethod = 'equal';
  window.pgSpMode = function(m){
    currentSpMethod = m;
    var btnEqual = document.getElementById('pg-sp-btn-equal');
    var btnVlsm = document.getElementById('pg-sp-btn-vlsm');
    var panelEqual = document.getElementById('pg-sp-panel-equal');
    var panelVlsm = document.getElementById('pg-sp-panel-vlsm');

    if(btnEqual) btnEqual.classList.toggle('is-active', m==='equal');
    if(btnVlsm) btnVlsm.classList.toggle('is-active', m==='vlsm');
    if(panelEqual) panelEqual.style.display = m==='equal'?'':'none';
    if(panelVlsm) panelVlsm.style.display = m==='vlsm'?'':'none';
  };

  window.pgSpResetSlider = function(){
    var baseCidr = parseInt(document.getElementById('pg-sp-basecidr').value, 10);
    var slider = document.getElementById('pg-sp-slider');
    if(slider){
      slider.min = baseCidr + 1;
      slider.max = 30;
      slider.value = Math.min(baseCidr + 2, 30);
    }
  };

  window.pgSpRun = function(){
    var baseIp = document.getElementById('pg-sp-ip').value.trim();
    var baseCidr = parseInt(document.getElementById('pg-sp-basecidr').value, 10);
    var slider = document.getElementById('pg-sp-slider');
    var targetCidr = slider ? parseInt(slider.value, 10) : baseCidr+2;
    var errEl = document.getElementById('pg-sp-err');
    var lbl = document.getElementById('pg-sp-slider-lbl');

    if(lbl) {
      var numSubnets = Math.pow(2, targetCidr - baseCidr);
      var usableHosts = targetCidr === 30 ? 2 : Math.pow(2, 32 - targetCidr) - 2;
      lbl.textContent = '/' + targetCidr + ' (' + numSubnets + ' subnets of ' + usableHosts + ' hosts)';
    }
    if(errEl) errEl.textContent = '';

    if(!v4ok(baseIp)){
      if(errEl&&baseIp.length>6) errEl.textContent = 'Invalid base network IP';
      return;
    }

    var baseU32 = ip2u32(baseIp);
    var maskU32 = cidrMask(baseCidr);
    var baseNet = (baseU32 & maskU32)>>>0;
    
    var tbody = document.getElementById('pg-sp-tbody');
    if(tbody) tbody.innerHTML = '';

    var subnetsCount = Math.pow(2, targetCidr - baseCidr);
    var step = Math.pow(2, 32 - targetCidr);
    var subMask = cidrMask(targetCidr);
    var subWild = (~subMask)>>>0;

    var limit = Math.min(subnetsCount, 128); 
    for(var i=0; i<limit; i++){
      var subNet = (baseNet + i * step)>>>0;
      var subBcast = (subNet + subWild)>>>0;
      var range = targetCidr === 30 ? u32ip(subNet+1)+' – '+u32ip(subBcast-1) : u32ip(subNet+1)+' – '+u32ip(subBcast-1);
      if(targetCidr===31) range = u32ip(subNet)+' – '+u32ip(subBcast);
      var hostsCount = targetCidr === 32 ? 1 : (targetCidr === 31 ? 2 : step - 2);

      var tr = document.createElement('tr');
      tr.innerHTML = '<td>Subnet #' + (i+1) + '</td>' +
                     '<td>' + u32ip(subNet) + '/' + targetCidr + '</td>' +
                     '<td>' + u32ip(subMask) + '</td>' +
                     '<td>' + range + '</td>' +
                     '<td style="font-weight:bold;color:var(--pg-accent);">' + hostsCount.toLocaleString() + '</td>';
      if(tbody) tbody.appendChild(tr);
    }
  };

  window.pgConvRun = function(){
    var inp = document.getElementById('pg-conv-input').value.trim();
    var errEl = document.getElementById('pg-conv-err');
    var res = document.getElementById('pg-conv-results');

    if(errEl) errEl.textContent = '';
    if(res) res.style.display = 'none';
    if(!inp) return;

    function setv(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
    function seth(id,v){ var e=document.getElementById(id); if(e) e.innerHTML=v; }
    function show(){ if(res) res.style.display=''; }

    if(v4ok(inp)){
      var val = ip2u32(inp);
      var isMask = (val & 1) === 0 && ((val >>> 1) | val) === 0xffffffff;
      
      var inv = (~val)>>>0;
      var isWild = (inv & 1) === 0 && ((inv >>> 1) | inv) === 0xffffffff;

      if(isMask || val === 0){
        var c = 32 - Math.log2(~val + 1);
        if(val === 0) c = 0;
        setv('pg-conv-type', 'IPv4 Subnet Mask');
        setv('pg-conv-prefix', '/'+c);
        setv('pg-conv-mask', inp);
        setv('pg-conv-wild', u32ip(~val));
        seth('pg-conv-binary', colorBinStr(u32bin(val)));
        document.getElementById('pg-conv-v4-mask-box').style.display = '';
        document.getElementById('pg-conv-v6-mask-box').style.display = 'none';
        document.getElementById('pg-conv-binary-row').style.display = '';
        show();
        return;
      }
      if(isWild || inv === 0){
        var c = 32 - Math.log2(~inv + 1);
        if(inv === 0) c = 0;
        setv('pg-conv-type', 'IPv4 Wildcard Mask');
        setv('pg-conv-prefix', '/'+c);
        setv('pg-conv-mask', u32ip(~inv));
        setv('pg-conv-wild', inp);
        seth('pg-conv-binary', colorBinStr(u32bin(~inv)));
        document.getElementById('pg-conv-v4-mask-box').style.display = '';
        document.getElementById('pg-conv-v6-mask-box').style.display = 'none';
        document.getElementById('pg-conv-binary-row').style.display = '';
        show();
        return;
      }
      if(errEl) errEl.textContent = 'Not a standard mask pattern';
      return;
    }

    if(inp.includes('/')){
      var parts = inp.split('/');
      var ipPart = parts[0].trim();
      var maskPart = parts[1].trim();
      var bi3 = v6parse(ipPart);
      
      if(bi3 !== null){
        var prefixNum = parseInt(maskPart, 10);
        if(!isNaN(prefixNum) && prefixNum >= 0 && prefixNum <= 128){
          var hm = (BigInt(1) << BigInt(128 - prefixNum)) - BigInt(1);
          var nm = ~hm &#038; ((BigInt(1) << BigInt(128)) - BigInt(1));

          setv('pg-conv-type', 'IPv6 Subnet Block');
          setv('pg-conv-prefix', '/'+prefixNum);
          setv('pg-conv-wild', v6compress(hm));
          setv('pg-conv-v6-mask', v6compress(nm));
          document.getElementById('pg-conv-v4-mask-box').style.display = 'none';
          document.getElementById('pg-conv-v6-mask-box').style.display = '';
          document.getElementById('pg-conv-binary-row').style.display = 'none';
          show();
          return;
        }
      }
    }

    var pMatch = /^\/?(\d{1,3})$/.exec(inp);
    if(pMatch){
      var cNum = parseInt(pMatch[1], 10);
      if(cNum >= 0 && cNum <= 32){
        var mask = cidrMask(cNum);
        setv('pg-conv-type', 'IPv4 CIDR Prefix');
        setv('pg-conv-prefix', '/'+cNum);
        setv('pg-conv-mask', u32ip(mask));
        setv('pg-conv-wild', u32ip(~mask));
        seth('pg-conv-binary', colorBinStr(u32bin(mask)));
        document.getElementById('pg-conv-v4-mask-box').style.display = '';
        document.getElementById('pg-conv-v6-mask-box').style.display = 'none';
        document.getElementById('pg-conv-binary-row').style.display = '';
        show();
        return;
      }
      if(cNum > 32 && cNum <= 128){
        var hm = (BigInt(1) << BigInt(128 - cNum)) - BigInt(1);
        var nm = ~hm &#038; ((BigInt(1) << BigInt(128)) - BigInt(1));
        setv('pg-conv-type', 'IPv6 CIDR Prefix');
        setv('pg-conv-prefix', '/'+cNum);
        setv('pg-conv-wild', v6compress(hm));
        setv('pg-conv-v6-mask', v6compress(nm));
        document.getElementById('pg-conv-v4-mask-box').style.display = 'none';
        document.getElementById('pg-conv-v6-mask-box').style.display = '';
        document.getElementById('pg-conv-binary-row').style.display = 'none';
        show();
        return;
      }
    }
    if(errEl&#038;&#038;inp.length>2) errEl.textContent = 'Unrecognized input';
  };

  var _baseConverting = false;
  window.pgBaseInput = function(sourceType){
    if(_baseConverting) return;
    _baseConverting = true;

    var inputVal = (document.getElementById('pg-base-' + sourceType)||{}).value||'';
    inputVal = inputVal.trim();

    var errEl = document.getElementById('pg-base-err');
    if(errEl) errEl.textContent = '';
    ['pg-base-bin-err','pg-base-oct-err','pg-base-dec-err','pg-base-hex-err'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.textContent='';
    });

    if(!inputVal){
      ['pg-base-bin','pg-base-oct','pg-base-dec','pg-base-hex'].forEach(function(id){
        if(id !== 'pg-base-' + sourceType) {
          var e=document.getElementById(id); if(e) e.value='';
        }
      });
      _baseConverting = false;
      return;
    }

    var validators = {
      bin: /^[01]+$/,
      oct: /^[0-7]+$/,
      dec: /^[0-9]+$/,
      hex: /^[0-9A-Fa-f]+$/
    };

    if(!validators[sourceType].test(inputVal)){
      var badEl = document.getElementById('pg-base-' + sourceType + '-err');
      if(badEl) {
        badEl.textContent = 'Invalid base character';
        badEl.style.display = 'inline';
      }
      _baseConverting = false;
      return;
    }

    var baseRadix = { bin:2, oct:8, dec:10, hex:16 };
    var numValue = BigInt(0);
    try {
      if (sourceType === 'dec') {
        numValue = BigInt(inputVal);
      } else {
        var base = BigInt(baseRadix[sourceType]);
        var chars = inputVal.toLowerCase().split('');
        for(var i=0; i<chars.length; i++){
          var digit = BigInt(parseInt(chars[i], baseRadix[sourceType]));
          numValue = numValue * base + digit;
        }
      }
    } catch(err) {
      if(errEl) errEl.textContent = 'Overflow error';
      _baseConverting = false;
      return;
    }

    if(sourceType !== 'bin') {
      var binEl = document.getElementById('pg-base-bin');
      if(binEl) binEl.value = numValue.toString(2);
    }
    if(sourceType !== 'oct') {
      var octEl = document.getElementById('pg-base-oct');
      if(octEl) octEl.value = numValue.toString(8);
    }
    if(sourceType !== 'dec') {
      var decEl = document.getElementById('pg-base-dec');
      if(decEl) decEl.value = numValue.toString(10);
    }
    if(sourceType !== 'hex') {
      var hexEl = document.getElementById('pg-base-hex');
      if(hexEl) hexEl.value = numValue.toString(16).toUpperCase();
    }
    _baseConverting = false;
  };

  window.pgBaseClear = function(){
    _baseConverting=false;
    ['pg-base-bin','pg-base-oct','pg-base-dec','pg-base-hex'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.value='';
    });
    ['pg-base-bin-err','pg-base-oct-err','pg-base-dec-err','pg-base-hex-err'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.textContent='';
    });
  };

  function pgInit(){
    var saved;
    try{ saved=localStorage.getItem('isub_pg_accent'); }catch(e){}
    if(saved){
      var dot=document.querySelector('.isub-pg__dot[data-color="'+saved+'"]');
      pgSetAccent(saved, dot);
    }
    pgV4Calc();
    pgV6Calc();
    pgSpResetSlider();
    pgSpRun();
    pgConvRun();

    var isDark=document.body.classList.contains('dark-mode');
    var btn=document.getElementById('isubnet-theme-toggle');
    if(btn) btn.textContent=isDark?'☀️':'🌙';
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',pgInit);
  } else {
    pgInit();
  }
  setTimeout(pgInit, 500);

  if(window.MutationObserver){
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.type==='attributes'&#038;&#038;m.attributeName==='class'){
          var activeDot = document.querySelector('.isub-pg__dot.is-active');
          if (activeDot) { pgSetAccent(PG_ACCENT, activeDot); }
        }
      });
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
  }
})();

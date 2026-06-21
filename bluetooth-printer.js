// ============================================================
// BLUETOOTH THERMAL PRINTER — ESC/POS 58mm
// Kompatibel: Iware BT-58D PRO / C5813 / 58BC / MP
//             Rongta RPP02N / RPP300 / RPP200
//             Xprinter, GZM, HM-10 BLE UART
// dan printer ESC/POS 58mm generik lainnya
// Web Bluetooth API — Chrome Android 56+
// ============================================================

// ── State printer ──────────────────────────────────────────
var _btPrinter = {
  device:      null,  // BluetoothDevice
  server:      null,  // BluetoothRemoteGATTServer
  char:        null,  // BluetoothRemoteGATTCharacteristic
  connected:   false,
  connecting:  false,
};

// ── UUID Service/Characteristic ────────────────────────────
// FIX: Tambah UUID Rongta RPP02N / ISSC BLE UART series
// RPP02N pakai Microchip ISSC BLE module dengan UUID khusus
var _BT_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',  // iWare / generic Chinese 58mm
  '0000ff00-0000-1000-8000-00805f9b34fb',  // Xprinter / GZM variant
  '00001101-0000-1000-8000-00805f9b34fb',  // SPP classic (fallback)
  '0000ffe0-0000-1000-8000-00805f9b34fb',  // HM-10 BLE UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // Rongta / Sewoo (older)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // ✅ Rongta RPP02N / ISSC BLE UART primary
  '49535343-1e4d-4bd9-ba61-23c647249616',  // ✅ ISSC service variant
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',  // ✅ Rongta RPP alternate
  '0000ae30-0000-1000-8000-00805f9b34fb',  // Zijiang / Sewoo alternate
];

// FIX: Tambah write characteristic UUID untuk RPP02N
var _BT_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',  // iWare write char
  '0000ff02-0000-1000-8000-00805f9b34fb',  // Xprinter write char
  '0000ffe1-0000-1000-8000-00805f9b34fb',  // HM-10 UART TX
  '00002a06-0000-1000-8000-00805f9b34fb',  // generic
  '49535343-8841-43f4-a8d4-ecbe34729bb3',  // ✅ ISSC BLE UART write (RPP02N)
  '49535343-aca3-481c-91ec-d85e28a60318',  // ✅ ISSC BLE UART write (variant)
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',  // ✅ Rongta write char
];

// ── ESC/POS Command Builder ─────────────────────────────────
var ESC = 0x1B, GS = 0x1D, LF = 0x0A, HT = 0x09;

function _escCmd(){
  var bytes = [];
  for(var i=0;i<arguments.length;i++){
    var a = arguments[i];
    if(typeof a === 'number') bytes.push(a);
    else if(Array.isArray(a)) bytes = bytes.concat(a);
    else if(a instanceof Uint8Array){ for(var j=0;j<a.length;j++) bytes.push(a[j]); }
  }
  return new Uint8Array(bytes);
}

// Encode string ke bytes — Latin-1 + manual mapping karakter ID umum
function _escStr(str){
  str = str || '';
  str = str.replace(/[Rr]p\.?\s*/g,'Rp ');
  var bytes = [];
  for(var i=0;i<str.length;i++){
    var c = str.charCodeAt(i);
    if(c < 128) bytes.push(c);
    else bytes.push(0x3F); // '?' untuk karakter di luar ASCII
  }
  return new Uint8Array(bytes);
}

// Buat baris kiri-kanan dengan padding tengah (total 32 char untuk 58mm)
function _escRow(left, right, width){
  width = width || 32;
  left  = String(left  || '');
  right = String(right || '');
  var pad = width - left.length - right.length;
  if(pad < 1) pad = 1;
  var line = left;
  for(var i=0;i<pad;i++) line += ' ';
  line += right;
  return line;
}

// Center text di lebar 32 char
function _escCenter(text, width){
  width = width || 32;
  text = String(text || '');
  if(text.length >= width) return text;
  var pad = Math.floor((width - text.length) / 2);
  var s = '';
  for(var i=0;i<pad;i++) s += ' ';
  return s + text;
}

// Garis putus-putus 32 char
function _escDash(width){ var s=''; for(var i=0;i<(width||32);i++) s+='-'; return s; }

// Potong teks agar muat di width char (wrap ke baris baru)
function _escWrap(text, width){
  width = width || 32;
  text = String(text||'');
  var lines = [];
  while(text.length > width){
    var cut = width;
    for(var i=width-1;i>=width-8&&i>=0;i--){ if(text[i]===' '){ cut=i+1; break; } }
    lines.push(text.slice(0,cut).trimRight());
    text = text.slice(cut).trimLeft();
  }
  if(text) lines.push(text);
  return lines;
}

// Format angka ke rupiah tanpa simbol (e.g. 15.000)
function _fmtRp(n){ return parseInt(n||0).toLocaleString('id-ID'); }

// ── Build ESC/POS byte array dari data transaksi ────────────
function _buildStrukBytes(trx, cabangData){
  var WIDTH = 32;
  var buf   = [];

  function push(arr){ for(var i=0;i<arr.length;i++) buf.push(arr[i]); }
  function line(text){
    push(_escStr(text));
    buf.push(LF);
  }
  function emptyLine(){ buf.push(LF); }

  var cab    = cabangData ? cabangData.find(function(c){ return c.name === trx.cabang; }) : null;
  var addr   = cab ? (cab.addr || '') : '';
  var wa     = cab ? (cab.wa   || '') : '';
  var dt     = new Date(trx.tanggal);
  var validDt = !isNaN(dt.getTime());
  var tglStr  = validDt
    ? dt.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})
    : String(trx.tanggal||'').slice(0,10);
  var jamStr  = validDt
    ? dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false})
    : String(trx.tanggal||'').slice(11,16);
  var items   = Array.isArray(trx.items) ? trx.items : [];
  var totalQty = items.reduce(function(a,i){ return a+(i.qty||0); },0);
  var isTunai  = /tunai|cash/i.test(trx.bayar||'');

  // ── Init printer ──
  push(_escCmd(ESC, 0x40));                    // ESC @ — reset
  push(_escCmd(ESC, 0x74, 0x00));              // ESC t 0 — codepage PC437
  push(_escCmd(ESC, 0x61, 0x01));              // ESC a 1 — center align

  // ── Header ──
  push(_escCmd(ESC, 0x21, 0x10));              // ESC ! — double height
  line('KAMPUNG DIMSUM');
  push(_escCmd(ESC, 0x21, 0x00));              // normal size

  line(trx.cabang || '');
  if(addr && addr !== '—') line(addr);
  if(wa) line('WA: ' + wa);
  line('DIMSUM SEGAR - TOPPING BERLIMPAH');
  push(_escCmd(ESC, 0x61, 0x00));              // left align

  emptyLine();
  line(_escDash(WIDTH));

  // ── Info transaksi ──
  line(_escRow('No. Struk', trx.id || '', WIDTH));
  line(_escRow('Pelanggan', trx.pelanggan || 'Pelanggan Umum', WIDTH));
  line(_escRow('Pembayaran', trx.bayar || '-', WIDTH));
  line(_escRow('Tanggal', tglStr + ' ' + jamStr, WIDTH));
  line(_escDash(WIDTH));

  // ── Items ──
  items.forEach(function(item){
    var sub   = (item.sub != null) ? item.sub : (item.price||0)*(item.qty||0);
    var harga = _fmtRp(item.price||0);
    var subRp = _fmtRp(sub);

    var nameLines = _escWrap(item.name || '', WIDTH);
    nameLines.forEach(function(nl){ line(nl); });

    var calc = harga + ' x ' + item.qty;
    line(_escRow(' ' + calc, subRp, WIDTH));
  });

  line(_escDash(WIDTH));

  // ── Total ──
  push(_escCmd(ESC, 0x21, 0x00));
  line(_escRow('TOTAL ' + totalQty + ' QTY', _fmtRp(trx.total), WIDTH));

  push(_escCmd(ESC, 0x21, 0x30));              // double width + height
  line(_escRow('Bayar', _fmtRp(trx.total), WIDTH));
  push(_escCmd(ESC, 0x21, 0x00));              // normal

  if(isTunai){
    line(_escRow('Kembali', '0', WIDTH));
  }

  line(_escDash(WIDTH));

  // ── Footer ──
  push(_escCmd(ESC, 0x61, 0x01));              // center
  line('Terima kasih, semoga');
  line('menjadi langganan!');
  if(wa){
    line('Pesan lagi via WA:');
    line(wa);
  }
  emptyLine();

  // ── Cut kertas ──
  push(_escCmd(GS, 0x56, 0x41, 0x03));        // GS V A 3 — full cut + feed 3 lines

  return new Uint8Array(buf);
}

// ── Kirim data ke printer dalam chunk (BLE max MTU ~512, aman 100-200 byte/chunk) ──
async function _btSendBytes(bytes){
  var CHUNK = 100;
  for(var i=0;i<bytes.length;i+=CHUNK){
    var chunk = bytes.slice(i, i+CHUNK);
    await _btPrinter.char.writeValue(chunk);
    await new Promise(function(r){ setTimeout(r, 30); });
  }
}

// ── Connect ke printer ─────────────────────────────────────
// FIX: requestDevice dipanggil PERTAMA tanpa await lain di depannya
// agar user gesture context tidak expired di browser yang ketat.
async function btConnect(){
  if(_btPrinter.connecting){
    showToast('Sedang menghubungkan...','info');
    return false;
  }
  if(!navigator.bluetooth){
    showToast('Web Bluetooth tidak didukung. Gunakan Chrome Android terbaru.','error');
    return false;
  }

  _btPrinter.connecting = true;
  _btPrinter.connected  = false;
  _btUpdateUI();

  try {
    // FIX: requestDevice LANGSUNG dipanggil — tidak ada toast/await sebelumnya
    // agar browser tidak anggap gesture sudah expired
    var device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: _BT_SERVICE_UUIDS,
    });

    // Toast SETELAH device dipilih user (gesture sudah selesai, aman)
    showToast('Menghubungkan ke ' + (device.name || 'printer') + '...', 'info');

    _btPrinter.device = device;
    device.addEventListener('gattserverdisconnected', _btOnDisconnect);

    var server = await device.gatt.connect();
    _btPrinter.server = server;

    // Coba satu per satu service UUID sampai berhasil
    var service = null;
    for(var si=0;si<_BT_SERVICE_UUIDS.length;si++){
      try {
        service = await server.getPrimaryService(_BT_SERVICE_UUIDS[si]);
        if(service) break;
      } catch(e){ service = null; }
    }

    // Fallback: ambil semua service lalu coba satu-satu
    if(!service){
      try {
        var services = await server.getPrimaryServices();
        if(services && services.length > 0){
          service = services[0];
          console.log('[BT] Fallback service UUID:', service.uuid);
        }
      } catch(e){ service = null; }
    }

    if(!service){
      throw new Error('Service printer tidak ditemukan. Pastikan printer menyala dan dalam jangkauan.');
    }

    // Coba satu per satu characteristic UUID
    var char = null;
    for(var ci=0;ci<_BT_CHAR_UUIDS.length;ci++){
      try {
        char = await service.getCharacteristic(_BT_CHAR_UUIDS[ci]);
        if(char) break;
      } catch(e){ char = null; }
    }

    // Jika semua gagal, ambil characteristic pertama yang writable
    if(!char){
      var chars = await service.getCharacteristics();
      for(var i=0;i<chars.length;i++){
        var props = chars[i].properties;
        if(props.write || props.writeWithoutResponse){
          char = chars[i];
          console.log('[BT] Fallback char UUID:', char.uuid);
          break;
        }
      }
    }

    if(!char){
      throw new Error('Characteristic write printer tidak ditemukan.');
    }

    _btPrinter.char      = char;
    _btPrinter.connected = true;
    _btPrinter.connecting = false;
    _btUpdateUI();
    showToast('✅ Printer ' + (device.name||'') + ' terhubung!', 'success');
    return true;

  } catch(err){
    _btPrinter.connecting = false;
    _btPrinter.connected  = false;
    _btUpdateUI();
    // NotFoundError = user klik Cancel di dialog
    if(err.name === 'NotFoundError' || (err.message && err.message.includes('cancelled'))){
      showToast('Pencarian printer dibatalkan.', 'info');
    } else {
      showToast('Gagal hubungkan printer: ' + (err.message||err), 'error');
      console.warn('[BT]', err);
    }
    return false;
  }
}

// ── Disconnect ─────────────────────────────────────────────
function btDisconnect(){
  try {
    if(_btPrinter.device && _btPrinter.device.gatt.connected){
      _btPrinter.device.gatt.disconnect();
    }
  } catch(e){}
  _btPrinter.connected  = false;
  _btPrinter.char       = null;
  _btUpdateUI();
  showToast('Printer terputus.', 'info');
}

function _btOnDisconnect(){
  _btPrinter.connected = false;
  _btPrinter.char      = null;
  _btUpdateUI();
  showToast('Koneksi printer terputus.', 'error');
}

// ── Update tombol UI di popup struk ────────────────────────
function _btUpdateUI(){
  var btnConn  = document.getElementById('btn-bt-connect');
  var btnPrint = document.getElementById('btn-bt-print');
  var statusEl = document.getElementById('bt-status');

  if(statusEl){
    if(_btPrinter.connecting){
      statusEl.textContent = '⏳ Menghubungkan...';
      statusEl.style.color = '#f59e0b';
    } else if(_btPrinter.connected && _btPrinter.device){
      statusEl.textContent = '🟢 ' + (_btPrinter.device.name||'Printer') + ' — Terhubung';
      statusEl.style.color = '#10b981';
    } else {
      statusEl.textContent = '⚪ Belum terhubung';
      statusEl.style.color = '#888';
    }
  }

  if(btnConn){
    if(_btPrinter.connected){
      btnConn.textContent  = '⛔ Putuskan';
      btnConn.onclick      = btDisconnect;
      btnConn.style.background = '#888';
    } else {
      btnConn.textContent  = '🔵 Hubungkan Printer';
      btnConn.onclick      = btConnect;
      btnConn.style.background = '#1d4ed8';
    }
    btnConn.disabled = _btPrinter.connecting;
  }

  if(btnPrint){
    btnPrint.disabled = !_btPrinter.connected;
    btnPrint.style.opacity = _btPrinter.connected ? '1' : '0.45';
  }
}

// ── Print struk via Bluetooth ───────────────────────────────
async function btPrintStruk(trx){
  if(!_btPrinter.connected || !_btPrinter.char){
    showToast('Printer belum terhubung! Klik "Hubungkan Printer" dulu.', 'error');
    return;
  }

  var btnPrint = document.getElementById('btn-bt-print');
  if(btnPrint){ btnPrint.disabled = true; btnPrint.textContent = '⏳ Mencetak...'; }

  try {
    var bytes = _buildStrukBytes(trx, window.cabangData || []);
    await _btSendBytes(bytes);
    showToast('✅ Struk berhasil dicetak!', 'success');
  } catch(err){
    showToast('Gagal cetak: ' + (err.message||err), 'error');
    console.warn('[BT Print]', err);
    if(err.name === 'NetworkError' || (err.message && err.message.includes('GATT'))){
      _btOnDisconnect();
    }
  } finally {
    if(btnPrint){
      btnPrint.disabled = !_btPrinter.connected;
      btnPrint.textContent = '🖨️ Cetak Bluetooth';
    }
  }
}

// ── Inject UI Bluetooth ke dalam popup struk ────────────────
function _btInjectIntoStrukHTML(trxJson){
  return `
<div id="bt-panel" style="width:100%;max-width:400px;background:#1e293b;border-radius:12px;padding:16px 18px;font-family:sans-serif;color:#e2e8f0;box-sizing:border-box">
  <div style="font-size:13px;font-weight:700;margin-bottom:10px;letter-spacing:.5px">🖨️ CETAK BLUETOOTH</div>
  <div id="bt-status" style="font-size:12px;margin-bottom:12px;color:#888">⚪ Belum terhubung</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button id="btn-bt-connect"
      style="flex:1;min-width:140px;padding:11px 8px;border-radius:8px;border:none;background:#1d4ed8;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit"
      onclick="window.opener._btDoConnect(this)">🔵 Hubungkan Printer</button>
    <button id="btn-bt-print"
      style="flex:1;min-width:140px;padding:11px 8px;border-radius:8px;border:none;background:#c0261a;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;opacity:.45"
      disabled onclick="window.opener._btDoPrint(${trxJson})">🖨️ Cetak Bluetooth</button>
  </div>
  <div style="margin-top:10px;display:flex;gap:8px">
    <button onclick="window.print()"
      style="flex:1;padding:10px;border-radius:8px;border:none;background:#334155;color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📄 Cetak/PDF biasa</button>
    <button onclick="window.close()"
      style="flex:1;padding:10px;border-radius:8px;border:none;background:#334155;color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">✖ Tutup</button>
  </div>
</div>`;
}

// ── Bridge functions dipanggil dari popup via window.opener ──
// FIX: Jangan manipulasi DOM sebelum btConnect() — bisa expire user gesture
// di Chrome Android yang ketat. requestDevice harus jadi await pertama.
window._btDoConnect = async function(btn){
  // FIX: Langsung panggil btConnect DULU tanpa disable/textContent dulu
  var ok = await btConnect();
  // DOM update dilakukan SETELAH requestDevice selesai (gesture sudah expired wajar)
  if(btn){ btn.disabled = false; }
  if(btn && btn.ownerDocument && btn.ownerDocument.defaultView){
    _btSyncPopupUI(btn.ownerDocument.defaultView);
  }
};

window._btDoPrint = async function(trxData){
  await btPrintStruk(trxData);
};

// Sinkronisasi status koneksi ke UI di popup
function _btSyncPopupUI(popupWin){
  if(!popupWin || popupWin.closed) return;
  try {
    var statusEl  = popupWin.document.getElementById('bt-status');
    var btnConn   = popupWin.document.getElementById('btn-bt-connect');
    var btnPrint  = popupWin.document.getElementById('btn-bt-print');

    if(statusEl){
      if(_btPrinter.connecting){
        statusEl.textContent = '⏳ Menghubungkan...';
        statusEl.style.color = '#f59e0b';
      } else if(_btPrinter.connected && _btPrinter.device){
        statusEl.textContent = '🟢 ' + (_btPrinter.device.name||'Printer') + ' — Terhubung';
        statusEl.style.color = '#10b981';
      } else {
        statusEl.textContent = '⚪ Belum terhubung';
        statusEl.style.color = '#888';
      }
    }
    if(btnConn){
      if(_btPrinter.connected){
        btnConn.textContent  = '⛔ Putuskan';
        btnConn.style.background = '#64748b';
        btnConn.disabled = false;
        btnConn.onclick = function(){ window.opener.btDisconnect(); window.opener._btSyncPopupUI(window); };
      } else {
        btnConn.textContent  = '🔵 Hubungkan Printer';
        btnConn.style.background = '#1d4ed8';
        btnConn.disabled = false;
        btnConn.onclick = function(){ window.opener._btDoConnect(this); };
      }
    }
    if(btnPrint){
      btnPrint.disabled = !_btPrinter.connected;
      btnPrint.style.opacity = _btPrinter.connected ? '1' : '0.45';
    }
  } catch(e){ console.warn('[BT UI sync]', e); }
}

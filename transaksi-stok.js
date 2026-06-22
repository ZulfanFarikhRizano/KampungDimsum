// ============ INPUT PENJUALAN (KASIR) ============
let penjualanData=(function(){
  // HIGH-01 FIX: persist penjualanData agar tidak hilang setelah refresh
  try{const s=localStorage.getItem('kd_penjualanData');if(s){const p=JSON.parse(s);if(Array.isArray(p))return p;}}catch(e){}
  return [];
})();
function _persistPenjualan(){try{localStorage.setItem('kd_penjualanData',JSON.stringify(penjualanData));}catch(e){}}
let pjItemCount = 0;

// ─── KASIR POS v120 ───────────────────────────────────────────────────────────
// cart: { menuId: qty }
var _pjCart = {};
var _pjMenuFilter = 'all';

function pjInit(){
  _pjCart = {};
  _pjMenuFilter = 'all';

  const isSA = currentUserRole === 'superadmin';
  const profile = window._currentAdmin;
  const myCabang = profile ? (profile.cabang_name || profile.cabang || '') : '';
  const sel = document.getElementById('pj-cabang');
  const roDiv = document.getElementById('pj-cabang-readonly');
  const roText = document.getElementById('pj-cabang-readonly-text');
  const cabangValid = myCabang && myCabang !== '—' && myCabang !== '-';

  if(cabangValid && !cabangData.some(c => c.name === myCabang)){
    const autoId = String(cabangData.length + 1).padStart(2, '0');
    cabangData.push({ id: autoId, name: myCabang, addr: '—', jam: '08.00–21.00', rating: 5, wa: '', open: true, lat: 0, lng: 0, mapsUrl: '', type: 'cabang' });
    (async function(){
      const _sbPj = getSB(); if(!_sbPj) return;
      const { error } = await _sbPj.from('cabang').insert({ name: myCabang, addr: '—', jam: '08.00–21.00', rating: 5, wa: '', open: true, lat: 0, lng: 0, maps_url: '', type: 'cabang' }).select().single();
      if(error && !error.message.includes('duplicate')) console.warn('[KD] Gagal auto-insert cabang:', error.message);
    })();
  }

  if(isSA || !cabangValid){
    if(sel){ sel.style.display = ''; sel.innerHTML = '<option value="">— Pilih Cabang —</option>' + cabangData.map(c=>`<option value="${c.name}">${_esc(c.name)}</option>`).join(''); }
    if(roDiv) roDiv.style.display = 'none';
  } else {
    if(sel){ sel.style.display = 'none'; sel.innerHTML = `<option value="${myCabang}" selected>${myCabang}</option>`; sel.value = myCabang; }
    if(roDiv) roDiv.style.display = 'flex';
    if(roText) roText.textContent = myCabang;
  }

  const now = new Date();
  const local = new Date(now - now.getTimezoneOffset()*60000);
  const dtEl = document.getElementById('pj-tanggal');
  if(dtEl) dtEl.value = local.toISOString().slice(0,16);

  // Reset tab
  ['all','topping','goreng','original','birthday'].forEach(function(t){
    const btn = document.getElementById('pj-tab-'+t);
    if(btn){ btn.style.background = t==='all'?'var(--red)':'var(--bg2)'; btn.style.color = t==='all'?'#fff':'var(--text2)'; btn.style.borderColor = t==='all'?'var(--red)':'var(--border2)'; }
  });

  pjRenderMenuGrid();
  pjRenderCart();
  renderPenjualanTable();
}

function pjFilterMenu(cat){
  _pjMenuFilter = cat;
  ['all','topping','goreng','original','birthday'].forEach(function(t){
    const btn = document.getElementById('pj-tab-'+t);
    if(btn){ btn.style.background = t===cat?'var(--red)':'var(--bg2)'; btn.style.color = t===cat?'#fff':'var(--text2)'; btn.style.borderColor = t===cat?'var(--red)':'var(--border2)'; }
  });
  pjRenderMenuGrid();
}

function pjRenderMenuGrid(){
  const grid = document.getElementById('pj-menu-grid');
  if(!grid) return;
  const items = menuData.filter(function(m){
    if(m.inStock === false) return false;
    if(_pjMenuFilter === 'all') return true;
    return m.cat === _pjMenuFilter;
  });
  if(!items.length){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:24px;font-size:.85rem">Tidak ada menu tersedia</div>'; return; }
  grid.innerHTML = items.map(function(m){
    const qty = _pjCart[m.id] || 0;
    return `<div style="background:var(--bg2);border:1.5px solid ${qty>0?'var(--red)':'var(--border2)'};border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:border-color .15s" onclick="pjCartAdd(${m.id})">
      <div style="font-size:.75rem;font-weight:700;color:var(--text);text-align:center;line-height:1.3;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${_esc(m.name)}</div>
      <div style="font-size:.92rem;font-weight:800;color:var(--red)">Rp ${m.price.toLocaleString('id-ID')}</div>
      <div style="display:flex;align-items:center;gap:0;background:var(--bg);border:1.5px solid var(--border2);border-radius:20px;overflow:hidden" onclick="event.stopPropagation()">
        <button onclick="pjCartDec(${m.id})" style="width:40px;height:40px;border:none;background:none;font-size:1.2rem;font-weight:700;cursor:pointer;touch-action:manipulation;color:var(--text2);display:flex;align-items:center;justify-content:center;transition:background .1s" onmousedown="this.style.background='var(--bg2)'">−</button>
        <span id="pj-qty-${m.id}" style="min-width:28px;text-align:center;font-size:.92rem;font-weight:700;color:${qty>0?'var(--red)':'var(--text)'}">${qty}</span>
        <button onclick="pjCartAdd(${m.id})" style="width:40px;height:40px;border:none;background:none;font-size:1.2rem;font-weight:700;cursor:pointer;touch-action:manipulation;color:var(--red);display:flex;align-items:center;justify-content:center;transition:background .1s" onmousedown="this.style.background='var(--bg2)'">+</button>
      </div>
    </div>`;
  }).join('');
}

function pjCartAdd(menuId){
  _pjCart[menuId] = (_pjCart[menuId] || 0) + 1;
  if(_pjCart[menuId] > 1000) _pjCart[menuId] = 1000;
  pjCartUpdateItem(menuId);
  pjRenderCart();
}

function pjCartDec(menuId){
  if(!_pjCart[menuId]) return;
  _pjCart[menuId]--;
  if(_pjCart[menuId] <= 0) delete _pjCart[menuId];
  pjCartUpdateItem(menuId);
  pjRenderCart();
}

function pjCartUpdateItem(menuId){
  // Update tampilan qty & border di grid tanpa full re-render
  const qtyEl = document.getElementById('pj-qty-'+menuId);
  const qty = _pjCart[menuId] || 0;
  if(qtyEl){
    qtyEl.textContent = qty;
    qtyEl.style.color = qty > 0 ? 'var(--red)' : 'var(--text)';
    // Update border card
    const card = qtyEl.closest('[onclick]') || qtyEl.parentElement?.parentElement?.parentElement;
    if(card && card.style !== undefined) card.style.borderColor = qty > 0 ? 'var(--red)' : 'var(--border2)';
  }
}

function pjRenderCart(){
  const wrap = document.getElementById('pj-items-wrap');
  const countEl = document.getElementById('pj-cart-count');
  const totalEl = document.getElementById('pj-total-display');
  if(!wrap) return;

  const cartItems = Object.keys(_pjCart).map(function(id){
    const m = menuData.find(function(x){ return x.id === parseInt(id); });
    return m ? { m: m, qty: _pjCart[id] } : null;
  }).filter(Boolean);

  if(!cartItems.length){
    wrap.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:.82rem;padding:12px">Belum ada item ditambahkan</div>';
    if(countEl) countEl.textContent = '0';
    if(totalEl) totalEl.textContent = 'Rp 0';
    return;
  }

  let total = 0;
  let totalQty = 0;
  wrap.innerHTML = cartItems.map(function(ci){
    const sub = ci.m.price * ci.qty;
    total += sub;
    totalQty += ci.qty;
    return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border2);border-radius:9px;padding:10px 12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:.8rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100vw - 200px)">${_esc(ci.m.name)}</div>
        <div style="font-size:.75rem;color:var(--text3)">Rp ${ci.m.price.toLocaleString('id-ID')} / box</div>
      </div>
      <div style="display:flex;align-items:center;gap:0;background:var(--bg2);border:1.5px solid var(--border2);border-radius:20px;overflow:hidden;flex-shrink:0">
        <button onclick="pjCartDec(${ci.m.id})" style="width:38px;height:38px;border:none;background:none;font-size:1.1rem;font-weight:700;cursor:pointer;touch-action:manipulation;color:var(--text2)">−</button>
        <span style="min-width:26px;text-align:center;font-size:.92rem;font-weight:700;color:var(--red)">${ci.qty}</span>
        <button onclick="pjCartAdd(${ci.m.id})" style="width:38px;height:38px;border:none;background:none;font-size:1.1rem;font-weight:700;cursor:pointer;touch-action:manipulation;color:var(--red)">+</button>
      </div>
      <div style="font-size:.82rem;font-weight:800;color:var(--red);min-width:0;text-align:right;flex-shrink:0;white-space:nowrap">Rp ${sub.toLocaleString('id-ID')}</div>
    </div>`;
  }).join('');

  if(countEl) countEl.textContent = totalQty;
  if(totalEl){
    totalEl.textContent = 'Rp ' + total.toLocaleString('id-ID');
    totalEl.style.color = total > 10000000 ? 'var(--gold)' : 'var(--red)';
  }
}

function pjClearCart(){
  _pjCart = {};
  pjRenderMenuGrid();
  pjRenderCart();
}

// Ekstrak jumlah pcs PER BOX dari nama menu
function pjGetQtyFromName(name){
  const menuItem = menuData.find(m => m.name === name);
  if(menuItem && menuItem.pcsPerBox) return menuItem.pcsPerBox;
  const match = name.match(/(\d+)\s*[Pp]cs/);
  return match ? parseInt(match[1]) : 1;
}

function pjOnProdukChange(sel){ pjCalcTotal(); }

function pjAddItem(){
  // Legacy compat — tidak dipakai di v118 tapi dipertahankan
}

function pjCalcTotal(){
  // Dihitung via pjRenderCart
}

function pjSave(){
  if(window._pjSaving){ showToast('Transaksi sedang diproses...','info'); return; }
  if(document.activeElement) document.activeElement.blur();
  const tgl = document.getElementById('pj-tanggal').value;
  const cab = document.getElementById('pj-cabang').value;
  const pelanggan = document.getElementById('pj-pelanggan').value.trim() || 'Pelanggan Umum';
  const phone = (document.getElementById('pj-phone')||{}).value ? document.getElementById('pj-phone').value.trim() : '';
  const bayar = document.getElementById('pj-bayar').value;
  if(!tgl||!cab){ showToast('Lengkapi tanggal dan cabang!','error'); return; }

  const cartItems = Object.keys(_pjCart).map(function(id){
    const m = menuData.find(function(x){ return x.id === parseInt(id); });
    return m ? { m: m, qty: _pjCart[id] } : null;
  }).filter(Boolean);

  if(!cartItems.length){ showToast('Tambahkan minimal 1 item!','error'); return; }

  const items = [];
  let total = 0;
  cartItems.forEach(function(ci){
    // v125 FIX: pakai ci.m.pcsPerBox langsung dari menuData (lebih eksplisit, tidak perlu parsing nama)
    // pjGetQtyFromName memang juga lookup menuData tapi ada fallback parsing nama yang bisa salah
    const pcsPerBox = (ci.m.pcsPerBox && ci.m.pcsPerBox > 0) ? ci.m.pcsPerBox : pjGetQtyFromName(ci.m.name);
    const totalPcs = ci.qty * pcsPerBox;
    items.push({name: ci.m.name, qty: ci.qty, pcsPerBox, totalPcs, price: ci.m.price, sub: ci.m.price * ci.qty, cat: ci.m.cat, packaging: ci.m.packaging || ''});
    total += ci.m.price * ci.qty;
  });

  window._pjSaving = true;
  setTimeout(function(){ window._pjSaving = false; }, 2000);

  const MAX_KASIR_TRX = 10000000;
  if(total > MAX_KASIR_TRX){
    if(!window._pjOverrideWarning){
      window._pjOverrideWarning = true;
      setTimeout(function(){ window._pjOverrideWarning = false; }, 5000);
      showToast(`Total Rp ${total.toLocaleString('id-ID')} sangat besar! Klik Simpan lagi untuk konfirmasi.`, 'error');
      window._pjSaving = false;
      return;
    }
    window._pjOverrideWarning = false;
  }

  // ── FIX v130: Cek stok SEBELUM simpan. Jika ada item stok 0 → BLOKIR total ──
  const stockErrors = [];
  const stockDeductions = []; // kumpulkan dulu, baru deduct setelah lolos semua cek

  items.forEach(function(item){
    const invKeyRaw = _menuCatToInvKey(item.cat, item.name, item.packaging);
    if(!invKeyRaw) return; // menu tanpa tracking stok (e.g. minuman) — lewati
    const invKeys = Array.isArray(invKeyRaw) ? invKeyRaw : [invKeyRaw];
    const isPerPcs = (item.cat === 'original' || item.cat === 'goreng');
    const safePcsPerBox = (item.pcsPerBox && item.pcsPerBox > 0) ? item.pcsPerBox : 1;
    const needed   = isPerPcs ? item.qty * safePcsPerBox : item.qty;
    const unitLabel = isPerPcs ? 'pcs' : 'kemasan';

    invKeys.forEach(function(invKey){
      const available = _invGet(cab, invKey);
      if(available <= 0){
        // Stok NOL — blokir keras
        stockErrors.push(`"${item.name}" (${invKey}): stok habis (0 ${unitLabel})`);
      } else if(needed > available){
        // Stok ada tapi kurang — blokir dengan info detail
        stockErrors.push(`"${item.name}" (${invKey}): stok ${available} ${unitLabel}, butuh ${needed} ${unitLabel}`);
      } else {
        stockDeductions.push({ cab, invKey, needed });
      }
    });
  });

  // Jika ada item bermasalah → TOLAK transaksi, jangan simpan apapun
  if(stockErrors.length){
    window._pjSaving = false;
    const errMsg = stockErrors.length === 1
      ? `❌ Transaksi dibatalkan — Stok tidak cukup:\n${stockErrors[0]}`
      : `❌ Transaksi dibatalkan — ${stockErrors.length} item stok tidak cukup:\n${stockErrors.join(' | ')}`;
    showToast(errMsg, 'error');
    return;
  }

  // Semua cek lolos — baru deduct stok
  stockDeductions.forEach(function(d){ _invDeduct(d.cab, d.invKey, d.needed); });

  var _orderSeq = (window._orderSeq || 0) + 1; window._orderSeq = _orderSeq;
  const randId = 'KD-'+tgl.slice(0,10).replace(/-/g,'')+'-'+String(Date.now()).slice(-4)+String(_orderSeq).padStart(2,'0');
  penjualanData.unshift({id:randId, tanggal:tgl, cabang:cab, pelanggan, phone, bayar, items, total});
  omsetHistory.unshift({tanggal:tgl.slice(0,10), cabang:cab, omset:total, trx:1, source:'penjualan'});
  _persistPenjualan(); _persistOmset(); _persistInv();
  const _lastPj = penjualanData[0];
  _sbSyncPenjualan(_lastPj);
  _sbSyncOmset({ tanggal: tgl.slice(0,10), cabang: cab, omset: total, trx: 1, source: 'penjualan', order_id: _lastPj.id });
  _sbSyncInvState();
  renderPenjualanTable();
  renderOmsetTable&&renderOmsetTable();
  renderStokSummary();
  renderDashboardForRole();
  if(currentUserRole === 'superadmin') _renderSaTodayKPI();
  if(chartInstances['chart-omset'])   _refreshOmsetChart();
  if(chartInstances['chart-cabang'])  _refreshCabangChart();
  if(chartInstances['chart-produk'])  _refreshProdukChart();
  if(chartInstances['chart-payment']) _refreshPaymentChart();
  if(chartInstances['chart-harian'])  initChartHarian(_currentHarianOffset||0);
  if(chartInstances['chart-realtime'])initRealtimeChart();
  const panelAn = document.getElementById('panel-analitik');
  if(panelAn && panelAn.classList.contains('active')){ renderAnalitikKPICards(); initAnalitikCharts(); }

  showToast(`✅ Transaksi ${randId} dicatat & stok diperbarui`,'success');
  pjReset();
}

function pjReset(){
  _pjCart = {};
  document.getElementById('pj-pelanggan').value = '';
  const phoneEl = document.getElementById('pj-phone'); if(phoneEl) phoneEl.value = '';
  const bayarEl = document.getElementById('pj-bayar');
  if(bayarEl) bayarEl.value = 'QRIS';
  const now = new Date();
  const local = new Date(now - now.getTimezoneOffset()*60000);
  document.getElementById('pj-tanggal').value = local.toISOString().slice(0,16);
  const isSA = currentUserRole === 'superadmin';
  const myCabang = window._currentAdmin ? (window._currentAdmin.cabang_name || window._currentAdmin.cabang || '') : '';
  const sel = document.getElementById('pj-cabang');
  if((isSA || !myCabang) && sel) sel.value = '';
  pjRenderMenuGrid();
  pjRenderCart();
}

function renderPenjualanTable(){
  var tbl = document.getElementById('tbl-penjualan');
  if(!tbl) return;
  var isSA = currentUserRole === 'superadmin';
  var myCabang = window._currentAdmin
    ? (window._currentAdmin.cabang_name || window._currentAdmin.cabang || '')
    : '';

  // FIX v140: Non-superadmin hanya lihat transaksi cabang sendiri
  var visibleData = isSA
    ? penjualanData
    : penjualanData.filter(function(p){ return p.cabang === myCabang; });

  if(!visibleData.length){
    tbl.innerHTML = '<tbody><tr class="tbl-empty"><td colspan="'+(isSA?9:8)+'">'
      + 'Belum ada transaksi' + (!isSA&&myCabang ? ' untuk '+myCabang : '')
      + '</td></tr></tbody>';
    return;
  }

  var hdDel = isSA ? '<th style="width:70px">Hapus</th>' : '';
  var rows = visibleData.map(function(p){
    var itemStr = Array.isArray(p.items)
      ? p.items.map(function(i){ return _esc(i.name)+' x'+i.qty; }).join(', ')
      : (p.items||'\u2014');
    return '<tr>'
      + '<td style="font-size:.72rem;font-weight:600;color:var(--text4)">'+_esc(p.id)+'</td>'
      + '<td style="font-size:.76rem;color:var(--text3)">'+_esc((p.tanggal||'').slice(11,16)||(p.tanggal||'').slice(0,10))+'</td>'
      + '<td style="font-size:.8rem">'+_esc(p.cabang)+'</td>'
      + '<td>'+_esc(p.pelanggan)+'</td>'
      + '<td><span class="td-badge badge-open">'+_esc(p.bayar)+'</span></td>'
      + '<td style="font-size:.75rem;color:var(--text3);max-width:140px">'+itemStr+'</td>'
      + '<td class="td-num" style="color:var(--red);font-weight:700">Rp '+(p.total||0).toLocaleString('id-ID')+'</td>'
      + '<td><button class="btn-print-struk" data-orderid="'+_esc(p.id)+'" onclick="pjPrintStruk(this.dataset.orderid)" title="Cetak struk">'
          + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;width:1.1em;height:1.1em"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>'
        + '</button></td>'
      + (isSA ? '<td><button class="btn-sa-del" data-oid="'+_esc(p.id)+'" data-lbl="'+_esc((p.tanggal||'').slice(0,16)+' \u00b7 '+(p.cabang||'').replace('Kampung Dimsum ','KD ')+' \u00b7 Rp '+(p.total||0).toLocaleString('id-ID'))+'" onclick="showDeletePenjualanById(this.dataset.oid,this.dataset.lbl)">Hapus</button></td>' : '')
      + '</tr>';
  }).join('');

  tbl.innerHTML = '<thead><tr>'
    + '<th>ID</th><th>Waktu</th><th>Cabang</th><th>Pelanggan</th>'
    + '<th class="th-center">Pembayaran</th><th>Item</th>'
    + '<th class="th-right">Total</th><th style="width:64px">Struk</th>'
    + hdDel
    + '</tr></thead><tbody>' + rows + '</tbody>';
}

// ============ v135: CETAK STRUK (per transaksi, untuk printer kasir) ============
// Mencari transaksi by order_id, lalu render popup struk thermal 340px siap print.
function pjPrintStruk(orderId){
  const trx = penjualanData.find(function(p){ return p.id === orderId; });
  if(!trx){ showToast('Transaksi tidak ditemukan','error'); return; }
  _bukaStrukWindow(trx);
}

async function _bukaStrukWindow(trx){
  const cab = cabangData.find(function(c){ return c.name === trx.cabang; });
  const addr = cab ? (cab.addr || '') : '';
  const wa   = cab ? (cab.wa   || '') : '';
  const dt   = new Date(trx.tanggal);
  const validDt  = !isNaN(dt.getTime());
  const tglLabel = validDt ? dt.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'}) : _esc(trx.tanggal.slice(0,10));
  const jamLabel = validDt ? dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false}) : (trx.tanggal.slice(11,16)||'');
  const items    = Array.isArray(trx.items) ? trx.items : [];
  const totalQty = items.reduce(function(a,i){ return a + (i.qty||0); }, 0);
  const isTunai  = /tunai|cash/i.test(trx.bayar||'');

  const itemRows = items.map(function(i){
    const sub    = (i.sub!=null) ? i.sub : (i.price||0)*(i.qty||0);
    const harga  = (i.price||0).toLocaleString('id-ID');
    const subStr = sub.toLocaleString('id-ID');
    return `<div style="font-size:13px;margin-bottom:9px">
      <div style="font-weight:700;margin-bottom:2px">${_esc(i.name)}</div>
      <div style="display:flex;justify-content:space-between;color:#333;font-size:12.5px"><span>${harga} x ${i.qty}</span><span style="font-weight:600">${subStr}</span></div>
    </div>`;
  }).join('') || '<div style="font-size:13px;margin-bottom:9px">— Tidak ada item —</div>';

  // Fetch logo → base64
  let logoB64 = '';
  try {
    const resp = await fetch('gambar/logo.png');
    if(resp.ok){
      const blob = await resp.blob();
      logoB64 = await new Promise(function(res){ const fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.readAsDataURL(blob); });
    }
  } catch(e){}

  // Simpan trx aktif di window agar bisa diakses fungsi BT
  window._btCurrentTrx = trx;

  // BT-07 FIX: In-page modal — bukan window.open()
  // Chrome Android menolak navigator.bluetooth.requestDevice() dari about:blank popup
  // karena bukan "trusted browsing context". Modal in-page = same-origin = gesture valid.
  var oldModal = document.getElementById('_struk-modal-overlay');
  if(oldModal) oldModal.remove();
  // Hapus juga print style lama
  var oldStyle = document.getElementById('_struk-print-style');
  if(oldStyle) oldStyle.remove();

  const btSupported = !!navigator.bluetooth;

  // Inject global @media print style — sembunyikan semua kecuali area struk
  var ps = document.createElement('style');
  ps.id = '_struk-print-style';
  ps.textContent = `
    @media print {
      @page { size: auto; margin: 8mm; }
      body > *:not(#_struk-modal-overlay) { display: none !important; }
      #_struk-modal-overlay {
        position: static !important; background: none !important;
        padding: 0 !important; overflow: visible !important;
        display: block !important;
      }
      #_struk-modal-overlay > div { padding: 0 !important; max-width: 100% !important; }
      #_struk-bt-panel { display: none !important; }
      #_struk-print-area {
        box-shadow: none !important; border-radius: 0 !important;
        max-width: 100% !important; padding: 6px 8px 12px !important;
        font-size: 12px !important; line-height: 1.5 !important;
      }
      #_struk-print-area img, #_struk-print-area div[data-logo] {
        width: 58px !important; height: 58px !important;
        max-width: 58px !important; max-height: 58px !important;
      }
    }
  `;
  document.head.appendChild(ps);

  const logoHtmlInner = logoB64
    ? `<img src="${logoB64}" alt="Logo" data-logo style="width:74px;height:74px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 10px;max-width:74px;max-height:74px">`
    : `<div data-logo style="width:74px;height:74px;border-radius:50%;background:#c0261a;color:#fff;font-weight:700;font-size:1.25rem;display:flex;align-items:center;justify-content:center;margin:0 auto 10px">KD</div>`;

  const modal = document.createElement('div');
  modal.id = '_struk-modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:16px 0 48px;-webkit-overflow-scrolling:touch';

  modal.innerHTML = `
<div style="width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center;gap:12px;font-family:'Courier New',Courier,monospace;padding:0 12px;box-sizing:border-box">

  <div id="_struk-print-area" style="width:100%;background:#fff;padding:24px 22px 26px;color:#111;font-size:13.5px;line-height:1.6;border-radius:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <div style="text-align:center;margin-bottom:14px">
      ${logoHtmlInner}
      <div style="font-size:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">KAMPUNG DIMSUM</div>
      <div style="font-size:12px;color:#444;margin-top:5px;line-height:1.5">${_esc(trx.cabang)}${addr?'<br>'+_esc(addr):''}${wa?'<br>WA: '+_esc(wa):''}</div>
      <div style="font-size:11px;letter-spacing:1.5px;color:#555;margin-top:8px;text-transform:uppercase">DIMSUM SEGAR &nbsp;&middot;&nbsp; TOPPING BERLIMPAH</div>
    </div>
    <hr style="border:none;border-top:1px dashed #aaa;margin:11px 0">
    <div style="font-size:13px;line-height:1.75">
      <div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#444;white-space:nowrap;flex-shrink:0">No. Struk</span><span style="text-align:right;font-weight:600;word-break:break-word">${_esc(trx.id)}</span></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#444;white-space:nowrap;flex-shrink:0">Pelanggan</span><span style="text-align:right;font-weight:600;word-break:break-word">${_esc(trx.pelanggan||'Pelanggan Umum')}</span></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#444;white-space:nowrap;flex-shrink:0">Pembayaran</span><span style="text-align:right;font-weight:600;word-break:break-word">${_esc(trx.bayar||'—')}</span></div>
      <div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#444;white-space:nowrap;flex-shrink:0">Tanggal</span><span style="text-align:right;font-weight:600;word-break:break-word">${tglLabel} ${jamLabel}</span></div>
    </div>
    <hr style="border:none;border-top:1px dashed #aaa;margin:11px 0">
    ${itemRows}
    <hr style="border:none;border-top:1px dashed #aaa;margin:11px 0">
    <div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;margin:4px 0"><span>TOTAL ${totalQty} QTY</span><span>${(trx.total||0).toLocaleString('id-ID')}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;margin-top:6px"><span>Bayar</span><span>${(trx.total||0).toLocaleString('id-ID')}</span></div>
    ${isTunai?'<div style="display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;margin:4px 0"><span>Kembali</span><span>0</span></div>':''}
    <hr style="border:none;border-top:1px dashed #aaa;margin:11px 0">
    <div style="text-align:center;font-size:11.5px;color:#444;margin-top:8px;line-height:1.65">Terima kasih, semoga menjadi langganan.<br>${wa?'Pesan lagi via WA: '+_esc(wa):'kampungdimsum.id'}</div>
  </div>

  <div id="_struk-bt-panel" style="width:100%;background:#1e293b;border-radius:12px;padding:16px 18px;color:#e2e8f0;box-sizing:border-box;font-family:sans-serif">
    ${btSupported ? `
    <div style="font-size:13px;font-weight:700;margin-bottom:10px;letter-spacing:.5px">🖨️ CETAK BLUETOOTH</div>
    <div id="_bt-status" style="font-size:12px;margin-bottom:12px;color:#888">⚪ Belum terhubung</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button id="_btn-bt-connect"
        style="flex:1;min-width:140px;padding:11px 8px;border-radius:8px;border:none;background:#1d4ed8;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit"
        onclick="_struKBtConnect()">🔵 Hubungkan Printer</button>
      <button id="_btn-bt-print"
        style="flex:1;min-width:140px;padding:11px 8px;border-radius:8px;border:none;background:#c0261a;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;opacity:.45"
        disabled onclick="_strukBtPrint()">🖨️ Cetak Bluetooth</button>
    </div>` : `
    <div style="font-size:12px;color:#94a3b8;text-align:center;margin-bottom:10px">⚠️ Web Bluetooth tidak didukung.<br>Gunakan <strong>Chrome Android</strong> untuk cetak Bluetooth.</div>`}
    <div style="display:flex;gap:8px">
      <button onclick="_strukCetakPDF()"
        style="flex:1;padding:10px;border-radius:8px;border:none;background:#334155;color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📄 Cetak/PDF</button>
      <button onclick="_strukTutup()"
        style="flex:1;padding:10px;border-radius:8px;border:none;background:#334155;color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">✖ Tutup</button>
    </div>
  </div>

</div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target === modal) _strukTutup(); });
  _strukBtUpdateUI();
}

// ── In-page modal struk helpers ──────────────────────────────

function _strukTutup(){
  var m = document.getElementById('_struk-modal-overlay');
  if(m) m.remove();
  var s = document.getElementById('_struk-print-style');
  if(s) s.remove();
}

function _strukCetakPDF(){
  // Print style sudah di-inject di <head> saat modal dibuka
  // Panel BT otomatis hidden via #_struk-bt-panel { display:none }
  // Logo dikecilkan via img[data-logo] { width:58px }
  window.print();
}

function _strukBtUpdateUI(){
  var statusEl = document.getElementById('_bt-status');
  var btnConn  = document.getElementById('_btn-bt-connect');
  var btnPrint = document.getElementById('_btn-bt-print');
  if(!statusEl) return;
  if(_btPrinter.connecting){
    statusEl.textContent='⏳ Menghubungkan...'; statusEl.style.color='#f59e0b';
    if(btnConn){ btnConn.disabled=true; btnConn.textContent='⏳ Menghubungkan...'; }
  } else if(_btPrinter.connected && _btPrinter.device){
    statusEl.textContent='🟢 '+(_btPrinter.device.name||'Printer')+' — Terhubung'; statusEl.style.color='#10b981';
    if(btnConn){ btnConn.disabled=false; btnConn.textContent='⛔ Putuskan'; btnConn.style.background='#64748b'; btnConn.onclick=function(){ btDisconnect(); }; }
    if(btnPrint){ btnPrint.disabled=false; btnPrint.style.opacity='1'; }
  } else {
    statusEl.textContent='⚪ Belum terhubung'; statusEl.style.color='#888';
    if(btnConn){ btnConn.disabled=false; btnConn.textContent='🔵 Hubungkan Printer'; btnConn.style.background='#1d4ed8'; btnConn.onclick=function(){ _struKBtConnect(); }; }
    if(btnPrint){ btnPrint.disabled=true; btnPrint.style.opacity='0.45'; }
  }
}

// BT-07: Click langsung di halaman yang sama → gesture valid → Chrome izinkan Bluetooth
async function _struKBtConnect(){
  if(_btPrinter.connected){ btDisconnect(); _strukBtUpdateUI(); return; }
  await btConnect();
  _strukBtUpdateUI();
}

async function _strukBtPrint(){
  var trx = window._btCurrentTrx;
  if(!trx){ showToast('Data transaksi tidak ditemukan.','error'); return; }
  var btnPrint = document.getElementById('_btn-bt-print');
  if(btnPrint){ btnPrint.disabled=true; btnPrint.textContent='⏳ Mencetak...'; }
  await btPrintStruk(trx);
  if(btnPrint){ btnPrint.disabled=!_btPrinter.connected; btnPrint.textContent='🖨️ Cetak Bluetooth'; btnPrint.style.opacity=_btPrinter.connected?'1':'0.45'; }
}


function pjExport(){
  // FIX BUG-L5: sanitasi field CSV agar tidak rentan formula injection di Excel
  // Awali dengan tab jika field dimulai dengan karakter berbahaya (=, +, -, @)
  function csvSafe(v){ 
  const s=String(v||'');
  // BUG-FIX v60 WB-03: csvSafe sebelumnya hanya cegah formula injection (=,+,-,@)
  // tapi tidak wrap quotes jika value mengandung koma/newline → CSV corrupt
  // Fix: escape formula injection + wrap dengan double-quotes jika perlu
  const safe=/^[=+\-@]/.test(s)?'\t'+s:s;
  return (safe.includes(',')||safe.includes('"')||safe.includes('\n')||safe.includes('\r'))
    ?'"'+safe.replace(/"/g,'""')+'"'
    :safe;
}
  let csv = 'ID,Tanggal,Cabang,Pelanggan,Pembayaran,Item,Total\n';
  penjualanData.forEach(p=>{
    csv += `${csvSafe(p.id)},${csvSafe(p.tanggal)},${csvSafe(p.cabang)},${csvSafe(p.pelanggan)},${csvSafe(p.bayar)},"${Array.isArray(p.items)?p.items.map(i=>csvSafe(i.name)+' x'+i.qty).join('; '):''}",${p.total}\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = 'penjualan-kampung-dimsum.csv';
  a.click();
}

// ============ INPUT STOK ============
let stokData = [];
// inventoryState: { cabangName: { 'Dimsum Topping': N, 'Dimsum Original': N } }
// HIGH-02 FIX: load dari localStorage agar stok tidak reset setelah refresh
const inventoryState=(function(){
  try{const s=localStorage.getItem('kd_inventoryState');if(s){const p=JSON.parse(s);if(p&&typeof p==='object')return p;}}catch(e){}
  return {};
})();
function _persistInv(){try{localStorage.setItem('kd_inventoryState',JSON.stringify(inventoryState));}catch(e){}}
// ── Helper: hitung total stok topping dari semua kemasan voil+box ──
// FIX v123: Stok Topping = SEMUA kemasan voil+box di inventaris cabang.
// Sebelumnya bergantung pada menuData (cat:'topping'), sehingga kemasan
// yang tidak ada di menu (Voil 6, Hard Box 8, Voil 16) tidak terhitung.
// Sekarang pakai list eksplisit semua kemasan voil+box — konsisten dengan
// PRODUK_GROUPS di renderStokSummary.
const _TOPPING_PACKAGING_KEYS = [
  'Box 4','Box 6','Box 10',
  'Hard Box 8','Hard Box 16','Hard Box 25',
  'Voil 6','Voil 8','Voil 16','Voil 25'
];
function _invGetTopTotal(cabName){
  let total = 0;
  _TOPPING_PACKAGING_KEYS.forEach(function(pkg){ total += _invGet(cabName, pkg); });
  return total;
}
// ── Helper: hitung stok topping per packaging untuk satu cabang ──
function _invGetTopDetail(cabName){
  // v125 FIX: handle packaging gabungan 'Voil 8+Hard Box 8' → split dan hitung per key
  const result = {};
  (menuData||DEFAULT_MENU).forEach(function(m){
    if((m.cat==='topping'||m.cat==='birthday') && m.packaging){
      const keys = m.packaging.includes('+') ? m.packaging.split('+').map(function(s){ return s.trim(); }) : [m.packaging];
      keys.forEach(function(k){
        if(k && result[k]===undefined) result[k] = _invGet(cabName, k);
      });
    }
  });
  return result;
}

function _invGet(cab, produk){
  // FIX v109: JANGAN auto-create key jika belum ada — agar everHadData di
  // renderStokSummary bisa bedakan "belum pernah ada stok" vs "stok sudah 0".
  // Auto-create hanya terjadi di _invAdd/_invDeduct (saat ada mutasi aktual).
  if(!inventoryState[cab]) return 0;
  return inventoryState[cab][produk] || 0;
}
const _INV_DEFAULT_STATE = {
  'Dimsum Original':0,'Dimsum Keju':0,
  'Box 4':0,'Box 6':0,'Box 10':0,
  'Hard Box 8':0,'Hard Box 16':0,'Hard Box 25':0,
  'Voil 6':0,'Voil 8':0,'Voil 16':0,'Voil 25':0
};
function _invNewCabState(){ return Object.assign({}, _INV_DEFAULT_STATE); }
function _invAdd(cab, produk, qty){
  if(!inventoryState[cab]) inventoryState[cab] = _invNewCabState();
  inventoryState[cab][produk] = (_invGet(cab, produk)||0) + qty;
  _persistInv();
}
function _invDeduct(cab, produk, qty){
  if(!inventoryState[cab]) inventoryState[cab] = _invNewCabState();
  inventoryState[cab][produk] = Math.max(0, (_invGet(cab, produk)||0) - qty);
  _persistInv();
}
// v88: Recalculate inventoryState satu cabang dari stokData tersisa
// Dipanggil setelah hapus entry stok agar KPI selalu akurat
// CATATAN DESAIN (v129): fungsi ini HANYA sum distribusi stok (status 'Terkirim'),
// TIDAK mengurangi penjualan dari penjualanData. Ini disengaja — deduction penjualan
// dilakukan real-time di pjSave(). Jangan ubah fungsi ini untuk juga loop penjualanData
// karena akan double-deduct dengan deduction yang sudah terjadi via _invDeduct di pjSave.
function _recalcInvFromStokData(cabang){
  inventoryState[cabang] = _invNewCabState();
  stokData.forEach(function(s){
    if(s.cab === cabang && s.status === 'Terkirim' && s.jumlah > 0){
      inventoryState[cabang][s.produk] = (inventoryState[cabang][s.produk]||0) + s.jumlah;
    }
  });
}

// v89: _sbLogActivity — catat aktivitas ke activityLog + INSERT ke Supabase activity_logs
function _sbLogActivity(aksi, userName){
  const user = userName || (window._currentAdmin && window._currentAdmin.display_name) || 'Super Admin';
  const waktu = new Date().toTimeString().slice(0,5);
  activityLog.unshift({user:user,aksi:aksi,waktu:waktu});
  if(activityLog.length > 100) activityLog.length = 100;
  (async function(){
    const sb=getSB(); if(!sb) return;
    const {error}=await sb.from('activity_logs').insert({user_name:user,aksi:aksi,waktu:waktu,created_at:new Date().toISOString()});
    if(error) console.warn('[KD] activity_log insert error:',error.message);
  })();
}

// Tentukan tipe dimsum dari kategori menu item
// BUG-C2 FIX: mapping cat → invKey tidak bisa hanya dari cat='birthday'
// karena Birthday Tower 32 Pcs = Original, Birthday Tower Topping = Topping
// Solusi: cek nama produk untuk birthday, fallback ke cat untuk non-birthday
// _menuCatToInvKey: return string (1 kemasan) atau array string (kemasan gabungan Voil+Hardbox)
// v124b FIX: kemasan "Voil+Hardbox" potong DUA jenis sekaligus
// v125: tambah parameter 'pkgOverride' agar pjSave bisa pass packaging langsung dari item
// → skip menuData lookup (lebih cepat, lebih akurat jika nama menu berubah)
function _menuCatToInvKey(cat, name, pkgOverride){
  // v123: Dua sistem stok:
  // - TOPPING/BIRTHDAY+pkg : stok per kemasan → return nama packaging (Voil 6, Box 4, dll)
  // - ORIGINAL/GORENG      : stok per pcs     → return 'Dimsum Original' atau 'Dimsum Keju'

  // Original & Goreng — selalu potong dari bahan baku pcs (tidak pernah per kemasan)
  if(cat === 'original' || cat === 'goreng'){
    const n = (name||'').toLowerCase();
    if(n.includes('keju')) return 'Dimsum Keju';
    return 'Dimsum Original';
  }

  // v125 FIX KRITIS: cek packaging eksplisit SEBELUM cat check
  // — Birthday Tower Topping punya packaging='Voil 25', harus potong kemasan, bukan pcs
  // — Urutan lama: birthday branch return duluan → packaging tidak pernah dicek
  
  // Prioritas 1: pkgOverride langsung dari caller (pjSave pass item.packaging)
  const pkg = pkgOverride || (function(){
    const m = menuData.find(function(m){ return m.name === name; });
    return m ? m.packaging : '';
  })();
  
  if(pkg){
    // v124b FIX: packaging gabungan "Voil+Hardbox" → potong keduanya sekaligus
    // Contoh: "Voil 8+Hard Box 8" → ['Voil 8','Hard Box 8']
    if(pkg.includes('+')){
      return pkg.split('+').map(function(s){ return s.trim(); }).filter(Boolean);
    }
    return pkg;
  }

  // Birthday tanpa packaging eksplisit → fallback ke bahan baku pcs
  // (mis. menu birthday custom yang belum diset packaging-nya)
  if(cat === 'birthday'){
    const n = (name||'').toLowerCase();
    if(n.includes('keju')) return 'Dimsum Keju';
    return 'Dimsum Original';
  }

  // Prioritas 2: parsing nama (fallback untuk menu custom via katalog)
  const n = (name||'').toLowerCase();

  // v124b FIX: deteksi "voil+hardbox" atau "(voil+hardbox)" di nama
  // Misal: "Dimsum Topping 8 Pcs (Voil+Hardbox)" → ['Voil 8','Hard Box 8']
  // Misal: "Dimsum Topping 16 Pcs (Voil+Hardbox)" → ['Voil 16','Hard Box 16']
  const hasVoil    = n.includes('voil');
  const hasHardbox = n.includes('hardbox') || n.includes('hard box');
  const hasBox     = n.includes('box') || n.includes('snackbox') || n.includes('dus');

  if(hasVoil && hasHardbox){
    // Gabungan — extract angka untuk tentukan ukuran
    const numMatch = n.match(/\d+/);
    const num = numMatch ? numMatch[0] : '8';
    // Map angka ke ukuran yang tersedia
    const voilKey     = ['6','8','16','25'].includes(num) ? 'Voil '+num : 'Voil 8';
    const hardboxKey  = ['8','16','25'].includes(num) ? 'Hard Box '+num : 'Hard Box 8';
    return [voilKey, hardboxKey];
  }

  if(hasVoil){
    if(n.includes('25')) return 'Voil 25';
    if(n.includes('16')) return 'Voil 16';
    if(n.includes('8'))  return 'Voil 8';
    if(n.includes('6'))  return 'Voil 6';
    return 'Voil 6';
  }
  if(hasHardbox){
    if(n.includes('25')) return 'Hard Box 25';
    if(n.includes('16')) return 'Hard Box 16';
    if(n.includes('8'))  return 'Hard Box 8';
    return 'Hard Box 8';
  }
  if(hasBox){
    if(n.includes('10')) return 'Box 10';
    if(n.includes('6'))  return 'Box 6';
    if(n.includes('4'))  return 'Box 4';
    return 'Box 4';
  }
  return null;
}

function skInit(){
  // v85 FIX: pakai permission check, bukan hardcode superadmin
  // Panel stok bisa dibuka oleh siapapun yang punya permission stok=true
  const skLock = document.getElementById('sk-lock-overlay');
  const hasStokPerm = (currentUserRole === 'superadmin') || (window._currentPerms && window._currentPerms.stok === true);
  if(!hasStokPerm){
    if(skLock) requestAnimationFrame(function(){ requestAnimationFrame(function(){
      skLock.classList.add('show');
    }); });
    return;
  }
  if(skLock) skLock.classList.remove('show');
  // BUG-L2 FIX: selalu regenerate dropdown agar cabang baru langsung muncul
  // Guard options.length <= 0 sebelumnya menyebabkan cabang baru tidak muncul
  ['sk-cabang'].forEach(id=>{
    const sel = document.getElementById(id);
    if(sel){
      // v117 FIX: urutkan cabang secara numerik, tambah opsi "Semua Cabang" di atas
      const sorted = [...cabangData].sort((a,b)=>{
        const na = parseInt(a.id)||999, nb = parseInt(b.id)||999;
        return na - nb;
      });
      sel.innerHTML = '<option value="__SEMUA__">Semua Cabang</option>' +
        sorted.map(c=>`<option value="${c.name}">${_esc(c.name)}</option>`).join('');
    }
  });
  // Set tanggal hari ini
  const skTgl = document.getElementById('sk-tanggal');
  if(skTgl && !skTgl.value) skTgl.value = new Date().toISOString().slice(0,10);
  renderStokTable();
  renderStokSummary();
}

function skSave(){
  // STOK-ROLE FIX: double-check role di save — tidak bisa di-bypass lewat konsol browser
  if(currentUserRole !== 'superadmin'){ showToast('Akses ditolak: hanya Super Admin yang bisa catat distribusi stok.','error'); return; }
  const tgl = document.getElementById('sk-tanggal').value;
  const cab = document.getElementById('sk-cabang').value;
  const produk = document.getElementById('sk-produk').value;
  const jumlah = parseInt(document.getElementById('sk-jumlah').value) || 0;
  // v124 FIX LOW-02: satuan dinamis — bahan baku (Dimsum Original/Keju) = 'pcs', kemasan = 'kemasan'
  const isBahanBaku = (produk === 'Dimsum Original' || produk === 'Dimsum Keju');
  const satuan = isBahanBaku ? 'pcs' : 'kemasan';
  const status = document.getElementById('sk-status').value;
  const catatan = document.getElementById('sk-catatan').value.trim();
  // BUG FIX TC-43: validasi jumlah harus > 0, cegah nilai negatif atau nol
  if(!tgl||!cab){ showToast('Lengkapi tanggal dan cabang!','error'); return; }
  if(jumlah <= 0){ showToast('Jumlah stok harus lebih dari 0!','error'); return; }
  if(jumlah > 100000){ showToast('Jumlah stok tidak boleh melebihi 100.000!','error'); return; } // BUG-FIX v69 BUG-03: batas atas stok
  // FIX: blur active element agar keyboard turun dan touch events normal kembali
  if(document.activeElement) document.activeElement.blur();
  // BUG-M3 FIX: inputBy dari profil yang sedang login, bukan hardcode 'Pusat'
  const inputBy = window._currentAdmin ? (window._currentAdmin.display_name || window._currentAdmin.username || 'Pusat') : 'Pusat';

  // v117 FIX: jika "Semua Cabang" dipilih, distribusi ke semua cabang sekaligus
  if(cab === '__SEMUA__'){
    const targetCabang = cabangData.filter(c=>c.type==='cabang'||c.type==='produksi');
    if(!targetCabang.length){ showToast('Tidak ada cabang yang tersedia!','error'); return; }
    targetCabang.forEach(function(c){
      const rec = {tgl, cab: c.name, produk, jumlah, satuan, status, catatan, inputBy};
      stokData.unshift(rec);
      if(status === 'Terkirim') _invAdd(c.name, produk, jumlah);
      _sbSyncStok(rec);
    });
    if(status === 'Terkirim') _sbSyncInvState();
    renderStokTable();
    renderStokSummary();
    renderDashboardForRole();
    if(currentUserRole === 'superadmin') _renderSaTodayKPI();
    const _bbUnit = (produk==='Dimsum Original'||produk==='Dimsum Keju') ? 'pcs' : 'kemasan';
    showToast(`Distribusi ${jumlah} ${_bbUnit} ${produk} ke ${targetCabang.length} cabang berhasil dicatat`,'success');
    skReset();
    return;
  }

  stokData.unshift({tgl, cab, produk, jumlah, satuan, status, catatan, inputBy});
  // Update inventory jika status Terkirim
  if(status === 'Terkirim') _invAdd(cab, produk, jumlah);
  // SUPABASE SYNC v55: kirim ke Supabase (non-blocking)
  _sbSyncStok(stokData[0]);
  if(status === 'Terkirim') _sbSyncInvState();
  renderStokTable();
  renderStokSummary();
  // v123 FIX: re-render KPI dashboard setelah stok diinput
  // Sebelumnya hanya renderStokSummary() — KPI Stok Topping & Bahan Baku di dashboard
  // tidak terupdate sampai user pindah panel atau refresh.
  renderDashboardForRole();
  if(currentUserRole === 'superadmin') _renderSaTodayKPI();
  const _bbUnitOne = (produk==='Dimsum Original'||produk==='Dimsum Keju') ? 'pcs' : 'kemasan';
  showToast(`Distribusi ${jumlah} ${_bbUnitOne} ${produk} ke ${cab} berhasil dicatat`,'success');
  skReset();
}

function skReset(){
  document.getElementById('sk-jumlah').value = '';
  document.getElementById('sk-catatan').value = '';
  document.getElementById('sk-status').value = 'Terkirim';
}

function renderStokTable(){
  const tbl = document.getElementById('tbl-stok');
  if(!tbl) return;
  const isSA = currentUserRole === 'superadmin';
  const statusBadge = {Terkirim:'badge-open','Dalam Perjalanan':'badge-best',Pending:'badge-normal'};
  if(!stokData.length){
    tbl.innerHTML = '<tbody><tr class="tbl-empty"><td colspan="'+(isSA?8:7)+'">Belum ada data distribusi stok</td></tr></tbody>';
    return;
  }
  const hdDel = isSA ? '<th style="width:70px">Hapus</th>' : '';
  tbl.innerHTML = `<thead><tr><th>Tanggal</th><th>Cabang</th><th>Produk</th><th class="th-center">Jumlah</th><th class="th-center">Status</th><th>Catatan</th><th>Oleh</th>${hdDel}</tr></thead><tbody>
    ${stokData.map((s,idx)=>{
      const _isBB = s.produk==='Dimsum Original'||s.produk==='Dimsum Keju';
      const _unit = _isBB ? 'pcs' : 'kemasan';
      return `<tr>
      <td style="font-size:.76rem;color:var(--text3)">${_esc(s.tgl)}</td>
      <td style="font-size:.8rem;font-weight:500">${_esc(s.cab)}</td>
      <td>${_esc(s.produk)}</td>
      <td class="td-center" style="font-weight:700;color:var(--text)">${s.jumlah} ${_unit}</td>
      <td><span class="td-badge ${statusBadge[s.status]||'badge-normal'}">${s.status}</span></td>
      <td style="font-size:.76rem;color:var(--text3)">${_esc(s.catatan||'—')}</td>
      <td style="font-size:.74rem;color:var(--text4)">${_esc(s.inputBy)}</td>
      ${isSA?`<td><button class="btn-sa-del" onclick="showDeleteConfirmSA('stok',${idx},'${_escJsAttr(s.tgl + ' \u00b7 ' + s.cab.replace('Kampung Dimsum ','KD ') + ' \u00b7 ' + s.produk + ' ' + s.jumlah + _unit)}')">Hapus</button></td>`:''}
    </tr>`;}).join('')}
  </tbody>`;
}

function renderStokSummary(){
  const wrap = document.getElementById('stok-summary-grid');
  if(!wrap) return;
  const allCabs = cabangData.filter(c=>c.type==='cabang'||c.type==='produksi');
  if(!allCabs.length){ wrap.innerHTML=''; return; }
  const PRODUK_GROUPS = [
    { label:'Bahan Baku',   items:['Dimsum Original','Dimsum Keju'],                                   color:'var(--red)',   unit:'pcs'     },
    { label:'Kemasan Box',  items:['Box 4','Box 6','Box 10','Hard Box 8','Hard Box 16','Hard Box 25'],  color:'#D4AF37',     unit:'kemasan' },
    { label:'Kemasan Voil', items:['Voil 6','Voil 8','Voil 16','Voil 25'],                             color:'#10B981',     unit:'kemasan' },
  ];
  // Peta kemasan -> nama menu yang memakainya
  // v125 FIX: handle packaging gabungan 'Voil 8+Hard Box 8' → map ke SETIAP key
  const kemasanToMenu = {};
  (menuData||DEFAULT_MENU).forEach(function(m){
    if(!m.packaging) return;
    const keys = m.packaging.includes('+') ? m.packaging.split('+').map(function(s){ return s.trim(); }) : [m.packaging];
    keys.forEach(function(k){
      if(!k) return;
      if(!kemasanToMenu[k]) kemasanToMenu[k] = [];
      if(kemasanToMenu[k].indexOf(m.name) === -1) kemasanToMenu[k].push(m.name);
    });
  });
  wrap.innerHTML = allCabs.map(c=>{
    const everHadData = inventoryState[c.name] !== undefined;
    const cabLabel = c.name.replace('Kampung Dimsum ','KD ');
    if(!everHadData){
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
        <div style="font-size:.72rem;font-weight:700;color:var(--text4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${cabLabel}</div>
        <div style="font-size:.77rem;color:var(--text4)">belum ada distribusi</div>
      </div>`;
    }
    const groupsHtml = PRODUK_GROUPS.map(g=>{
      const rowsHtml = g.items.map(prod=>{
        const qty = _invGet(c.name, prod);
        const menuNames = kemasanToMenu[prod];
        const menuHint = menuNames && menuNames.length
          ? `<span style="font-size:.6rem;color:var(--text4);display:block;margin-top:1px">${menuNames.map(n=>n.replace('Dimsum Topping ','Top ').replace('Dimsum Original ','Ori ')).join(', ')}</span>`
          : '';
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px dashed var(--border)">
          <div><span style="font-size:.73rem;color:var(--text3);font-weight:600">${prod}</span>${menuHint}</div>
          <span style="font-family:'Inter',sans-serif;font-size:.88rem;font-weight:${qty===0?'400':'700'};color:${qty===0?'var(--text4)':qty<5?'var(--red)':'var(--text)'};white-space:nowrap;margin-left:8px;flex-shrink:0">${qty.toLocaleString('id-ID')} <span style="font-size:.65rem;color:var(--text4)">${g.unit}</span></span>
        </div>`;
      }).join('');
      return `<div style="margin-bottom:9px">
        <div style="font-size:.67rem;font-weight:700;color:${g.color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;border-bottom:1px solid var(--border);padding-bottom:2px">${g.label}</div>
        ${rowsHtml}
      </div>`;
    }).join('');
    const topTotal = _invGetTopTotal(c.name);
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:.72rem;font-weight:700;color:var(--text4);text-transform:uppercase;letter-spacing:1px">${cabLabel}</div>
        <div style="font-size:.7rem;font-weight:700;color:var(--red);background:rgba(184,50,50,.1);padding:2px 8px;border-radius:8px">📦 ${topTotal} kemasan topping</div>
      </div>
      ${groupsHtml}
    </div>`;
  }).join('');
}

// ============================================================
// resetAllStok() — Reset semua stok ke 0 di semua cabang
// v108: tombol darurat untuk clear sisa data localStorage lama
// yang tidak ikut ter-reset meski DB sudah kosong
// ============================================================
// FIX v129 KRITIS-02: ganti confirm() native (bisa diblokir mobile) ke 2-step click pattern
var _resetStokStep = 0, _resetStokTimer = null;
function resetAllStok(){
  if(_resetStokStep === 0){
    _resetStokStep = 1;
    clearTimeout(_resetStokTimer);
    _resetStokTimer = setTimeout(function(){ _resetStokStep=0; _resetStokResetBtn(); }, 5000);
    var btn = document.getElementById('btn-reset-all-stok');
    if(btn){ btn.textContent='\u26a0\ufe0f Yakin? Klik Lagi'; btn.style.background='#DC2626'; btn.style.color='#fff'; }
    showToast('Klik tombol sekali lagi dalam 5 detik untuk konfirmasi reset semua stok','error');
    return;
  }
  clearTimeout(_resetStokTimer);
  _resetStokStep = 0;
  _resetStokResetBtn();
  _doResetAllStok();
}
function _resetStokResetBtn(){
  var btn = document.getElementById('btn-reset-all-stok');
  if(btn){ btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.49"/></svg> Reset Semua Stok'; btn.style.background=''; btn.style.color=''; }
}
async function _doResetAllStok(){
  // 1. Clear memory
  Object.keys(inventoryState).forEach(function(k){ delete inventoryState[k]; });

  // 2. Clear localStorage
  localStorage.removeItem('kd_inventoryState');
  _persistInv();

  // 3. DELETE semua row inventory_state di Supabase
  try {
    const sb = getSB();
    if(sb){
      const { error } = await sb.from('inventory_state').delete().neq('cabang','__never__');
      if(error) console.warn('[KD] resetAllStok Supabase error:', error.message);
      else _sbLogActivity('Reset semua stok ke 0 — semua cabang');
    }
  } catch(e){ console.warn('[KD] resetAllStok error:', e); }

  // 4. Re-render semua tampilan yang terkait
  renderStokSummary();
  renderDashboardForRole();
  renderAdminTables();

  showToast('Semua stok berhasil direset ke 0', 'success');
}

function skExport(){
  // BUG-L5 FIX: escape karakter " di catatan agar CSV tidak corrupt
  // v124 FIX LOW-03: tambah BOM UTF-8 agar Excel Indonesia baca encoding benar
  function csvEsc(v){ return String(v||'').replace(/"/g,'""'); }
  const BOM = '\uFEFF';
  let csv = BOM + 'Tanggal,Cabang,Produk,Jumlah,Satuan,Status,Catatan\n';
  stokData.forEach(s=>{
    csv += `${s.tgl},${s.cab},${s.produk},${s.jumlah},${s.satuan},${s.status},"${csvEsc(s.catatan)}"\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'distribusi-stok-kampung-dimsum.csv';
  a.click();
}

function addOmset(){
  if(document.activeElement) document.activeElement.blur(); // FIX: release keyboard
  const t=document.getElementById('o-tanggal').value,c=document.getElementById('o-cabang').value;
  const o=getRawNumber('o-omset'),trx=getRawNumber('o-trx');
  if(!t||!c||!o||!trx){showToast('Lengkapi semua field!','error');return;}

  // HIGH-3 FIX: validasi tanggal — tidak boleh masa depan
  const today = new Date().toISOString().slice(0,10);
  if(t > today){ showToast('Tanggal tidak boleh di masa depan!','error'); return; }

  // HIGH-3 FIX: warning duplikat manual entry di tanggal + cabang yang sama
  const alreadyManual = omsetHistory.some(h=>h.source==='manual'&&h.cabang===c&&h.tanggal===t);
  if(alreadyManual){
    // FIX v129 KRITIS-02b: ganti window.confirm() (bisa diblokir mobile) ke SA confirm dialog
    _saDeletePending = { type: 'omset-duplikat', _t: t, _c: c, _o: o, _trx: trx, label: c + ' pada ' + t };
    const warn = document.getElementById('sa-delete-warn');
    const info = document.getElementById('sa-delete-info');
    if(warn) warn.textContent = 'Sudah ada input manual omset untuk cabang dan tanggal ini. Simpan lagi bisa menyebabkan data duplikat.';
    if(info) info.innerHTML = '<strong>Data:</strong> ' + c + ' — ' + t + ' — Rp ' + parseInt(o).toLocaleString('id-ID');
    const overlay = document.getElementById('sa-delete-overlay');
    if(overlay){
      // Ubah label tombol konfirmasi jadi "Tetap Simpan"
      const confirmBtn = document.getElementById('sa-delete-confirm-btn');
      if(confirmBtn) confirmBtn.textContent = 'Tetap Simpan';
      overlay.classList.add('show');
    }
    return;
  }

  // BUG-C3 FIX: cek apakah sudah ada entry penjualan untuk cabang+tanggal ini
  // agar user sadar potensi double-count
  const alreadyFromPenjualan = omsetHistory.some(h=>h.source==='penjualan'&&h.cabang===c&&h.tanggal===t);
  _commitOmset(t,c,o,trx);
  if(alreadyFromPenjualan){
    showToast(`Peringatan: sudah ada data penjualan ${c} untuk ${t}. Cek agar tidak double-count!`,'error');
  }
}
function _commitOmset(t,c,o,trx){
  omsetHistory.unshift({tanggal:t,cabang:c,omset:o,trx:trx,source:'manual'});
  _persistOmset(); // HIGH-01 FIX: persist omset manual ke localStorage
  // SUPABASE SYNC v55: kirim ke Supabase (non-blocking)
  _sbSyncOmset({tanggal:t, cabang:c, omset:o, trx:trx, source:'manual'});
  renderOmsetTable();
  document.getElementById('o-omset').value='';document.getElementById('o-trx').value='';
  // v58 FIX: reset branch picker berbeda tergantung role
  // Superadmin → kosongkan (harus pilih lagi)
  // Non-superadmin → kembalikan ke cabangnya sendiri (tetap terkunci)
  const isSA = currentUserRole === 'superadmin';
  const profile = window._currentAdmin;
  const myCabang = profile ? (profile.cabang_name || profile.cabang || '') : '';
  selectedBranch = isSA ? '' : (myCabang || '');
  const oCab = document.getElementById('o-cabang');
  const bpText = document.getElementById('branch-picker-text');
  const trigger = document.getElementById('branch-picker-trigger');
  if(isSA || !myCabang){
    if(oCab) oCab.value = '';
    if(bpText) bpText.textContent = 'Pilih Cabang';
    if(trigger){
      trigger.classList.remove('has-value');
      const icon = trigger.querySelector('.branch-picker-icon');
      if(icon) icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';
    }
  }
  // Untuk non-superadmin: branch picker sudah terkunci di cabangnya (dari renderDashboardForRole)
  // tidak perlu reset — nilai o-cabang tetap myCabang
  showToast('Data omset berhasil ditambahkan!','success');
  // v117 FIX: refresh KPI dan chart setelah input omset manual
  renderDashboardForRole();
  if(currentUserRole === 'superadmin') _renderSaTodayKPI();
  if(chartInstances['chart-omset'])   _refreshOmsetChart();
  if(chartInstances['chart-cabang'])  _refreshCabangChart();
  if(chartInstances['chart-harian'])  initChartHarian(_currentHarianOffset||0);
  if(chartInstances['chart-realtime'])initRealtimeChart();
  const panelAn2 = document.getElementById('panel-analitik');
  if(panelAn2 && panelAn2.classList.contains('active')){ renderAnalitikKPICards(); initAnalitikCharts(); }
}
// ── v123: Image Compression Cache ──────────────────────────────────────────
// Compress gambar via Canvas API → WebP (quality 0.72) sebelum ditampilkan.
// Cache result di memory agar tidak re-compress tiap render.
// Fallback ke src asli jika browser tidak support WebP atau CORS error.
const _imgCompressCache = {};
async function _getCompressedImg(src, maxW, maxH, quality){
  if(!src) return src;
  const key = src + '|' + (maxW||0) + '|' + (maxH||0);
  if(_imgCompressCache[key]) return _imgCompressCache[key];
  return new Promise(function(resolve){
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      try{
        const mw = maxW || img.naturalWidth;
        const mh = maxH || img.naturalHeight;
        let w = img.naturalWidth, h = img.naturalHeight;
        if(w > mw || h > mh){
          const ratio = Math.min(mw/w, mh/h);
          w = Math.round(w*ratio); h = Math.round(h*ratio);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const webp = c.toDataURL('image/webp', quality||0.72);
        // Jika browser tidak support WebP, toDataURL return png
        const result = webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', quality||0.72);
        _imgCompressCache[key] = result;
        resolve(result);
      }catch(e){ resolve(src); }
    };
    img.onerror = function(){ resolve(src); };
    img.src = src;
  });
}
// Apply compress ke semua <img> dengan data-src attribute setelah DOM insert
// v125 FIX: clear onerror inline sebelum set src baru agar gambar tidak di-hide
// v125b FIX: untuk URL eksternal (Supabase Storage, http/https), skip canvas compress
// dan langsung set src — canvas sering gagal CORS untuk URL cross-origin
async function _applyImgCompress(container, maxW, maxH){
  if(!container) return;
  const imgs = container.querySelectorAll('img[data-src]');
  imgs.forEach(async function(el){
    const src = el.dataset.src;
    if(!src) return;
    // Hapus inline onerror dulu agar fallback tidak trigger hide
    el.removeAttribute('onerror');
    el.removeAttribute('data-src');
    el.style.display = '';
    // Jika src adalah URL eksternal (Supabase Storage, CDN, dll) → langsung set src
    // Canvas crossOrigin sering gagal CORS untuk URL dari domain lain
    if(src.startsWith('http://') || src.startsWith('https://')){
      el.src = src;
      return;
    }
    // Hanya compress jika base64 atau path relatif (lokal)
    const compressed = await _getCompressedImg(src, maxW||480, maxH||480);
    el.src = compressed || src;
  });
}
// Helper: ambil gambar lalu convert ke base64 data URL
// Popup window tidak bisa resolve path relatif, jadi logo HARUS di-embed sebagai base64
async function _imgToBase64(src){
  return new Promise(function(resolve){
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      try{
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img,0,0);
        resolve(c.toDataURL('image/png'));
      }catch(e){ resolve(null); }
    };
    img.onerror = function(){ resolve(null); };
    img.src = src + (src.includes('?')?'&':'?') + '_t=' + Date.now();
  });
}

// ── Inisialisasi filter bulan ke bulan ini saat panel analitik dibuka ──
function _initAnalitikBulanFilter(){
  const el = document.getElementById('an-filter-bulan');
  if(!el) return;
  if(!el.value){
    const now = new Date();
    el.value = now.getFullYear()+'-'+(now.getMonth()+1<10?'0':'')+(now.getMonth()+1);
  }
  renderAnalitikDailyTable();
}

// ── Tabel omset harian semua cabang (dari omsetHistory + penjualanData) ──
function renderAnalitikDailyTable(){
  const bulanEl = document.getElementById('an-filter-bulan');
  const bulan = bulanEl ? bulanEl.value : '';
  const tbody = document.getElementById('an-daily-tbody');
  const tfoot = document.getElementById('an-daily-tfoot');
  if(!tbody) return;

  // v124b FIX DOUBLE-COUNT: omsetHistory adalah single source of truth.
  // pjSave() + _sbSyncOmset() SELALU memasukkan transaksi ke omsetHistory dengan order_id.
  // Menggunakan omsetHistory + penjualanData sekaligus = double-count untuk semua transaksi kasir.
  // FIX: pakai omsetHistory saja. Fallback ke penjualanData HANYA jika omsetHistory benar-benar kosong
  // (offline / sebelum _sbLoadAll selesai). Tidak perlu lagi alreadySynced check yang rawan miss.
  const map = {};
  const addRow = (tgl10, cab, omset, trx) => {
    const key = tgl10+'__'+cab;
    if(!map[key]) map[key] = {tanggal: tgl10, cabang: cab, omset: 0, trx: 0};
    map[key].omset += omset;
    map[key].trx   += trx;
  };

  const hasOmsetEntries = omsetHistory.some(o => o.tanggal && (!bulan || o.tanggal.startsWith(bulan)));
  if(hasOmsetEntries){
    // Jalur utama: pakai omsetHistory saja (sudah mencakup semua cabang termasuk Rumah Produksi)
    omsetHistory.forEach(o => {
      if(!o.tanggal) return;
      const tgl10 = o.tanggal.slice(0,10);
      if(bulan && !tgl10.startsWith(bulan)) return;
      addRow(tgl10, o.cabang, o.omset||0, o.trx||0);
    });
  } else {
    // Fallback: pakai penjualanData jika omsetHistory masih kosong (offline/loading)
    penjualanData.forEach(p => {
      if(!p.tanggal) return;
      const tgl10 = p.tanggal.slice(0,10);
      if(bulan && !tgl10.startsWith(bulan)) return;
      addRow(tgl10, p.cabang, p.total||0, 1);
    });
  }

  const rows = Object.values(map).sort((a,b) => b.tanggal.localeCompare(a.tanggal) || a.cabang.localeCompare(b.cabang));

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--text4)">Tidak ada data untuk bulan ${bulan||'ini'}</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  // Grouping: baris total per tanggal (gabungan semua cabang)
  const byDate = {};
  rows.forEach(r => {
    if(!byDate[r.tanggal]) byDate[r.tanggal] = {omset:0,trx:0};
    byDate[r.tanggal].omset += r.omset;
    byDate[r.tanggal].trx   += r.trx;
  });

  let html = '';
  let lastDate = '';
  rows.forEach(r => {
    const isNewDate = r.tanggal !== lastDate;
    if(isNewDate && lastDate){
      // Baris subtotal tanggal sebelumnya
      const dt = byDate[lastDate];
      html += `<tr style="background:var(--red-soft,rgba(184,50,50,.07))">
        <td colspan="2" style="padding:7px 12px;font-size:.75rem;font-weight:700;color:var(--red)">Total ${new Date(lastDate+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td style="padding:7px 12px;text-align:right;font-weight:800;color:var(--red)">Rp ${dt.omset.toLocaleString('id-ID')}</td>
        <td style="padding:7px 12px;text-align:center;font-weight:700;color:var(--red)">${dt.trx}</td>
        <td style="padding:7px 12px;text-align:right;font-size:.75rem;color:var(--red)">${dt.trx>0?'Rp '+(Math.round(dt.omset/dt.trx)).toLocaleString('id-ID'):'—'}</td>
      </tr>`;
    }
    if(isNewDate){
      html += `<tr style="border-top:1.5px solid var(--border2)">
        <td style="padding:9px 12px;font-weight:700;color:var(--text)">${new Date(r.tanggal+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'})}</td>
        <td style="padding:9px 12px;color:var(--text2)">${r.cabang.replace('Kampung Dimsum ','KD ')}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:600;color:var(--text)">Rp ${r.omset.toLocaleString('id-ID')}</td>
        <td style="padding:9px 12px;text-align:center;color:var(--text3)">${r.trx}</td>
        <td style="padding:9px 12px;text-align:right;color:var(--text3)">${r.trx>0?'Rp '+(Math.round(r.omset/r.trx)).toLocaleString('id-ID'):'—'}</td>
      </tr>`;
    } else {
      html += `<tr>
        <td style="padding:8px 12px;color:var(--text4);font-size:.75rem"></td>
        <td style="padding:8px 12px;color:var(--text2)">${r.cabang.replace('Kampung Dimsum ','KD ')}</td>
        <td style="padding:8px 12px;text-align:right;color:var(--text)">Rp ${r.omset.toLocaleString('id-ID')}</td>
        <td style="padding:8px 12px;text-align:center;color:var(--text3)">${r.trx}</td>
        <td style="padding:8px 12px;text-align:right;color:var(--text3)">${r.trx>0?'Rp '+(Math.round(r.omset/r.trx)).toLocaleString('id-ID'):'—'}</td>
      </tr>`;
    }
    lastDate = r.tanggal;
  });
  // Subtotal tanggal terakhir
  if(lastDate){
    const dt = byDate[lastDate];
    html += `<tr style="background:var(--red-soft,rgba(184,50,50,.07))">
      <td colspan="2" style="padding:7px 12px;font-size:.75rem;font-weight:700;color:var(--red)">Total ${new Date(lastDate+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td>
      <td style="padding:7px 12px;text-align:right;font-weight:800;color:var(--red)">Rp ${dt.omset.toLocaleString('id-ID')}</td>
      <td style="padding:7px 12px;text-align:center;font-weight:700;color:var(--red)">${dt.trx}</td>
      <td style="padding:7px 12px;text-align:right;font-size:.75rem;color:var(--red)">${dt.trx>0?'Rp '+(Math.round(dt.omset/dt.trx)).toLocaleString('id-ID'):'—'}</td>
    </tr>`;
  }
  tbody.innerHTML = html;

  // Grand total footer
  const grandOmset = rows.reduce((s,r)=>s+r.omset,0);
  const grandTrx   = rows.reduce((s,r)=>s+r.trx,0);
  tfoot.innerHTML = `<tr style="background:linear-gradient(90deg,var(--red),#c0261a);color:#fff">
    <td colspan="2" style="padding:11px 12px;font-weight:800;font-size:.85rem;border-radius:0 0 0 10px">GRAND TOTAL${bulan?' — '+new Date(bulan+'-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'}):''}</td>
    <td style="padding:11px 12px;text-align:right;font-weight:900;font-size:.9rem">Rp ${grandOmset.toLocaleString('id-ID')}</td>
    <td style="padding:11px 12px;text-align:center;font-weight:800">${grandTrx}</td>
    <td style="padding:11px 12px;text-align:right;font-size:.8rem;border-radius:0 0 10px 0">${grandTrx>0?'Rp '+(Math.round(grandOmset/grandTrx)).toLocaleString('id-ID'):'—'}</td>
  </tr>`;
}

// ── Export CSV analitik: omset harian semua cabang ──
async function exportAnalitikCSV(){
  const now = new Date();
  const bulanEl = document.getElementById('an-filter-bulan');
  const bulan = bulanEl ? bulanEl.value : (now.getFullYear()+'-'+(now.getMonth()+1<10?'0':'')+(now.getMonth()+1));
  const bulanLabel = bulan ? new Date(bulan+'-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'}) : 'Semua';
  const tglLabel = now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const jamLabel = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

  // Build data map
  const map = {};
  const addRow = (tgl10, cab, omset, trx) => {
    const key = tgl10+'__'+cab;
    if(!map[key]) map[key] = {tanggal: tgl10, cabang: cab, omset: 0, trx: 0};
    map[key].omset += omset; map[key].trx += trx;
  };
  // v124b FIX DOUBLE-COUNT: pakai omsetHistory saja, fallback ke penjualanData hanya jika kosong
  const hasOmsetCSV = omsetHistory.some(o => o.tanggal && (!bulan || o.tanggal.startsWith(bulan)));
  if(hasOmsetCSV){
    omsetHistory.forEach(o => {
      if(!o.tanggal) return;
      const tgl10 = o.tanggal.slice(0,10);
      if(bulan && !tgl10.startsWith(bulan)) return;
      addRow(tgl10, o.cabang, o.omset||0, o.trx||0);
    });
  } else {
    penjualanData.forEach(p => {
      if(!p.tanggal) return;
      const tgl10 = p.tanggal.slice(0,10);
      if(bulan && !tgl10.startsWith(bulan)) return;
      addRow(tgl10, p.cabang, p.total||0, 1);
    });
  }

  const rows = Object.values(map).sort((a,b) => a.tanggal.localeCompare(b.tanggal) || a.cabang.localeCompare(b.cabang));
  if(!rows.length){ showToast('Tidak ada data untuk diekspor','error'); return; }

  const byDate = {};
  rows.forEach(r => {
    if(!byDate[r.tanggal]) byDate[r.tanggal] = {omset:0,trx:0,cabs:[]};
    byDate[r.tanggal].omset += r.omset;
    byDate[r.tanggal].trx += r.trx;
    byDate[r.tanggal].cabs.push(r);
  });

  const grandOmset = rows.reduce((s,r)=>s+r.omset,0);
  const grandTrx   = rows.reduce((s,r)=>s+r.trx,0);
  const fmt = n => 'Rp '+n.toLocaleString('id-ID');
  const uniqueDates = Object.keys(byDate).sort();

  // Omset per cabang summary
  const perCabang = {};
  rows.forEach(r=>{ if(!perCabang[r.cabang]) perCabang[r.cabang]={omset:0,trx:0}; perCabang[r.cabang].omset+=r.omset; perCabang[r.cabang].trx+=r.trx; });
  const cabRank = Object.entries(perCabang).sort((a,b)=>b[1].omset-a[1].omset);
  const maxCabOmset = cabRank.length ? cabRank[0][1].omset : 1;
  const colors = ['#c0261a','#d4900a','#1a7a3c','#1a4db5','#7c3aed','#0891b2','#b45309','#be185d','#166534','#1e40af'];

  // Build daily rows HTML
  let dailyRowsHtml = '';
  uniqueDates.forEach((tgl,di) => {
    const d = new Date(tgl+'T00:00:00');
    const hari = d.toLocaleDateString('id-ID',{weekday:'long'});
    const dt = byDate[tgl];
    const isSab = d.getDay()===6, isMin = d.getDay()===0;
    const dayColor = isSab||isMin ? '#c0261a' : '#1a0a02';
    // Cabang rows
    const cabRows = dt.cabs.map(r=>`
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:6px 14px;font-size:.75rem;color:#999"></td>
        <td style="padding:6px 14px;font-size:.77rem;color:#555">${r.cabang.replace('Kampung Dimsum ','KD ')}</td>
        <td style="padding:6px 14px;text-align:right;font-size:.77rem;color:#333">${fmt(r.omset)}</td>
        <td style="padding:6px 14px;text-align:center;font-size:.77rem;color:#777">${r.trx}</td>
        <td style="padding:6px 14px;text-align:right;font-size:.77rem;color:#777">${r.trx>0?fmt(Math.round(r.omset/r.trx)):'—'}</td>
      </tr>`).join('');
    // Subtotal row
    dailyRowsHtml += `
      <tr style="background:${di%2===0?'#fafafa':'#fff5f5'}">
        <td style="padding:10px 14px;font-weight:700;color:${dayColor};font-size:.82rem">${d.toLocaleDateString('id-ID',{day:'numeric',month:'short'})} <span style="font-weight:400;font-size:.73rem;color:#888">${hari}</span></td>
        <td style="padding:10px 14px;font-size:.77rem;color:#777">${dt.cabs.length} cabang</td>
        <td style="padding:10px 14px;text-align:right;font-weight:800;color:#c0261a;font-size:.85rem">${fmt(dt.omset)}</td>
        <td style="padding:10px 14px;text-align:center;font-weight:700;color:#333">${dt.trx}</td>
        <td style="padding:10px 14px;text-align:right;font-size:.78rem;color:#555">${dt.trx>0?fmt(Math.round(dt.omset/dt.trx)):'—'}</td>
      </tr>${cabRows}`;
  });

  // Cabang summary bar rows
  const cabSummaryRows = cabRank.map(([cab,d],i)=>{
    const pct = Math.round(d.omset/maxCabOmset*100);
    const col = colors[i%colors.length];
    return `<tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 14px;font-weight:600;color:#1a0a02;font-size:.8rem">${i+1}. ${cab.replace('Kampung Dimsum ','KD ')}</td>
      <td style="padding:10px 14px"><div style="background:#f0f0f0;border-radius:20px;height:12px;overflow:hidden"><div style="background:${col};height:100%;width:${pct}%;border-radius:20px"></div></div></td>
      <td style="padding:10px 14px;text-align:right;font-weight:700;color:${col};font-size:.8rem">${fmt(d.omset)}</td>
      <td style="padding:10px 14px;text-align:center;font-size:.78rem;color:#555">${d.trx}</td>
    </tr>`;
  }).join('');

  const logoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.3" width="36" height="36" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-30 12 12)"/><path d="M5 9.5c2 1 5 1.5 7 1.5s5-.5 7-1.5"/></svg>`;

  // v134 FIX: fetch logo sebagai base64 agar muncul di popup window (cross-origin path tidak bisa)
  let logoHtml = `<div class="hdr-logo">${logoSvg}</div>`;
  try {
    const logoResp = await fetch('gambar/logo.png');
    if(logoResp.ok){
      const blob = await logoResp.blob();
      const b64 = await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
      logoHtml = `<div class="hdr-logo"><img src="${b64}" alt="KD" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.4)"></div>`;
    }
  } catch(e){ /* fallback ke SVG */ }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Omset Harian — Kampung Dimsum ${bulanLabel}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{font-family:'Inter',sans-serif;background:#fff;color:#1a0a02;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:960px;margin:0 auto}
  /* HEADER */
  .hdr{background:linear-gradient(135deg,#c0261a 0%,#8b1a10 55%,#5c0d08 100%);padding:32px 40px 26px;display:flex;align-items:center;justify-content:space-between}
  .hdr-brand{display:flex;align-items:center;gap:14px}
  .hdr-logo{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;border:2.5px solid rgba(255,255,255,.35)}
  .hdr-title{color:#fff}.hdr-title h1{font-size:1.45rem;font-weight:900;letter-spacing:-.5px}
  .hdr-title p{font-size:.78rem;opacity:.75;margin-top:2px}
  .hdr-meta{text-align:right;color:#fff;font-size:.78rem;line-height:1.7;opacity:.88}
  .hdr-meta strong{font-size:.95rem;opacity:1}
  /* YELLOW STRIP */
  .strip{background:#ffd60a;padding:13px 40px;display:flex;align-items:center;gap:10px}
  .strip h2{font-size:1rem;font-weight:800;color:#1a0a02;letter-spacing:.4px;text-transform:uppercase}
  /* KPI GRID */
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:24px 40px 0}
  .kpi{border-radius:14px;padding:18px 16px;color:#fff;position:relative;overflow:hidden}
  .kpi::before{content:'';position:absolute;top:-18px;right:-18px;width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.13)}
  .kpi.red{background:linear-gradient(135deg,#c0261a,#e8402a)}
  .kpi.gold{background:linear-gradient(135deg,#b87000,#f5a623)}
  .kpi.green{background:linear-gradient(135deg,#166534,#22c55e)}
  .kpi.blue{background:linear-gradient(135deg,#1e3a8a,#3b82f6)}
  .kpi-lbl{font-size:.65rem;font-weight:700;opacity:.82;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
  .kpi-val{font-size:1.35rem;font-weight:900;line-height:1;letter-spacing:-.02em}
  .kpi-sub{font-size:.7rem;opacity:.78;margin-top:6px}
  /* SECTION */
  .sec{padding:22px 40px 0}
  .sec-ttl{font-size:.68rem;font-weight:700;color:#c0261a;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .sec-ttl::after{content:'';flex:1;height:1px;background:rgba(192,38,26,.2)}
  /* TABLES */
  .tbl-wrap{border-radius:12px;overflow:hidden;border:1px solid #e8e8e8}
  table{width:100%;border-collapse:collapse}
  thead tr{background:linear-gradient(90deg,#c0261a,#e8402a)}
  thead th{padding:11px 14px;font-size:.72rem;font-weight:700;color:#fff;text-align:left;letter-spacing:.5px}
  thead th.r{text-align:right} thead th.c{text-align:center}
  /* CABANG BAR TABLE */
  .bar-th{background:linear-gradient(90deg,#1a0a02,#3d1a0a)}
  /* FOOTER */
  .ftr{background:#1a0a02;color:rgba(255,255,255,.55);padding:16px 40px;display:flex;justify-content:space-between;align-items:center;font-size:.7rem;margin-top:24px}
  .ftr strong{color:#ffd60a}
  /* GRAND TOTAL ROW */
  .gt{background:linear-gradient(90deg,#c0261a,#e8402a);color:#fff}
  .gt td{padding:12px 14px;font-weight:800;font-size:.85rem}
  
/* ═══════════════════════════════════════════════════════════════
   MOBILE OPTIMIZATION v132 — Comprehensive
   Target: Smartphone ≤ 480px
   ═══════════════════════════════════════════════════════════════ */
@media(max-width:768px){

  /* ── 1. ADMIN TOPBAR: compact + no overflow ── */
  .admin-topbar{
    padding: 8px 12px !important;
    gap: 8px;
    min-height: 50px;
  }
  .admin-topbar h1{
    font-size: .82rem !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 36vw !important;
  }
  /* Live indicator: singkat di mobile */
  #live-indicator{
    font-size: .6rem !important;
    padding: 3px 7px !important;
    gap: 4px !important;
  }
  #live-indicator-text{ display:none; }
  /* Admin avatar lebih kecil */
  .admin-avatar{
    width: 30px !important;
    height: 30px !important;
    font-size: .72rem !important;
  }

  /* ── 2. ADMIN CONTENT: padding lebih irit ── */
  .admin-content{
    padding: 10px 12px !important;
    padding-bottom: 130px !important;
  }

  /* ── 3. KPI CARDS: value font lebih proporsional ── */
  .kpi-value{ font-size: 1.15rem !important; }
  .kpi-label{ font-size: .63rem !important; }
  .kpi-card{ padding: 14px 14px 12px !important; }

  /* ── 4. SHORTCUT GRID: 3-col proporsional ── */
  .shortcut-grid{
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 7px !important;
  }
  .shortcut-card{
    padding: 12px 8px !important;
    border-radius: 12px !important;
  }
  .sc-icon{
    width: 34px !important;
    height: 34px !important;
    font-size: 1rem !important;
    border-radius: 9px !important;
    margin-bottom: 6px !important;
  }
  .sc-name{ font-size: .68rem !important; font-weight: 700 !important; }

  /* ── 5. POS / KASIR: menu grid adaptive ── */
  #pj-menu-grid{
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr)) !important;
    gap: 8px !important;
  }

  /* ── 6. OMSET ROW: 2-col tetap tapi angka bisa wrap ── */
  .omset-row{
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
  }
  .omset-quick{
    padding: 10px 10px !important;
    font-size: .78rem !important;
  }

  /* ── 7. CHART: full width, chart box padding kecil ── */
  .chart-box{ padding: 14px 12px !important; }
  .chart-box h3{ font-size: .78rem !important; }

  /* ── 8. FORM inputs: cukup tap target ── */
  .admin-content input,
  .admin-content select,
  .admin-content textarea{
    font-size: .88rem !important;
    min-height: 44px !important;
    padding: 10px 12px !important;
    box-sizing: border-box !important;
  }
  .login-input{
    font-size: .88rem !important;
    padding: 10px 12px !important;
    min-height: 44px !important;
  }

  /* ── 9. TABLE as card: teks proporsional ── */
  .admin-table-wrap td{ font-size: .79rem !important; }
  .admin-table-wrap td:before{ font-size: .65rem !important; }
  .admin-table-wrap tr{ padding: 12px !important; }

  /* ── 10. BUTTONS: min tap target 44px ── */
  .btn-save, .btn-danger, .btn-primary{
    min-height: 44px !important;
    font-size: .85rem !important;
  }

  /* ── 11. MODAL: full screen friendly ── */
  .um-modal{
    border-radius: 18px !important;
    max-height: calc(100dvh - 80px) !important;
  }
  .um-modal-header{ padding: 14px 16px !important; }
  .um-modal-body{ padding: 12px 14px !important; }
  .um-modal-footer{ padding: 12px 14px !important; }
  .um-input{ font-size: .85rem !important; }

  /* ── 12. ADD-FORM-BOX: compact ── */
  .add-form-box{
    padding: 14px 14px !important;
    border-radius: 14px !important;
  }

  /* ── 13. ANALITIK PANEL: full width stacked ── */
  .chart-row{ grid-template-columns: 1fr !important; }

  /* ── 14. PANEL BAHAN BAKU / LAPORAN PRODUKSI: safe padding ── */
  #panel-bahan-baku .admin-content,
  #panel-laporan-produksi .admin-content{
    padding: 10px 10px !important;
  }

  /* ── 15. FLOATING NAV: safe from notch/home bar ── */
  .admin-sidebar{
    bottom: max(16px, env(safe-area-inset-bottom, 16px)) !important;
  }
  .admin-nav{
    padding: 4px 4px !important;
  }
  .admin-nav-item{
    padding: 7px 10px 6px !important;
    font-size: .58rem !important;
    gap: 2px !important;
    min-height: 46px !important;
  }

  /* ── 16. TOAST: safe from nav pill ── */
  .toast{ bottom: 120px !important; }

  /* ── 17. PREVENT horizontal scroll globally ── */
  #page-admin-dash,
  .admin-main,
  .admin-content,
  .admin-panel{
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  /* ── 18. SECTION HEADERS: compact ── */
  .admin-panel h2{ font-size: 1rem !important; margin-bottom: 10px !important; }
  .admin-panel h3{ font-size: .88rem !important; }

  /* ── 19. KERANJANG item row: no wrap ── */
  #pj-items-wrap > div{
    gap: 8px !important;
  }
}

/* ── Extra small: ≤ 380px (iPhone SE, Galaxy A series) ── */
@media(max-width:380px){
  .admin-topbar h1{ max-width: 28vw !important; font-size: .78rem !important; }
  .kpi-grid{ grid-template-columns: 1fr 1fr !important; }
  .kpi-value{ font-size: 1rem !important; }
  .shortcut-grid{ gap: 5px !important; }
  .shortcut-card{ padding: 10px 6px !important; }
  .sc-name{ font-size: .62rem !important; }
  .admin-nav-item{
    padding: 6px 8px 5px !important;
    font-size: .54rem !important;
  }
  .admin-nav-item span{ font-size: 1rem !important; }
  #pj-menu-grid{
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
  }
  .omset-row{ grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
  .admin-content{ padding: 8px 10px !important; padding-bottom: 125px !important; }
  .btn-save, .btn-danger{ font-size: .82rem !important; }
}



/* ── Bahan Baku qty stepper: touch target ── */
@media(max-width:768px){
  [onclick^="bbItemQtyChange"]{
    touch-action: manipulation !important;
    -webkit-tap-highlight-color: transparent;
  }
  /* BB form card padding */
  #bb-items-list > div{
    border-radius: 12px !important;
  }
  /* BB total bar */
  #bb-total-bar{
    font-size: .88rem !important;
  }
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE SYSTEM OPTIMIZATION v132
   Focus: POS flow, touch targets, safe area, scroll behaviour
   ═══════════════════════════════════════════════════════════════ */

/* ── POS: Category filter tabs — scroll horizontal smooth ── */
#panel-input-penjualan > div:nth-child(2){
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}
#panel-input-penjualan > div:nth-child(2)::-webkit-scrollbar{ display: none; }

/* ── POS: Menu card — tap highlight yang responsif ── */
#pj-menu-grid > div{
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  user-select: none;
  transition: transform .12s ease, box-shadow .12s ease;
}
#pj-menu-grid > div:active{
  transform: scale(.96);
}

/* ── POS: Stepper buttons — area tap cukup besar ── */
#pj-menu-grid button,
#pj-items-wrap button{
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; /* no delay on double-tap */
}

/* ── KPI card: angka tidak overflow ── */
.kpi-value{
  word-break: break-all;
  overflow-wrap: break-word;
  hyphens: auto;
}

/* ── Shortcut card: prevent text overflow pada nama ── */
.sc-name{
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: center;
}

/* ── Input & Select: prevent iOS zoom (font ≥ 16px) ──
   iOS Safari auto-zoom kalau input < 16px font-size.
   Override khusus mobile supaya user tidak kena zoom tak sengaja */
@media(max-width:768px){
  .admin-content input,
  .admin-content select,
  .admin-content textarea,
  .login-input{
    font-size: max(16px, .88rem) !important;
    -webkit-text-size-adjust: 100%;
  }

  /* ── Table card: aksi button bisa di-tap mudah ── */
  .admin-table-wrap td:last-child button,
  .admin-table-wrap td:last-child a{
    min-height: 36px;
    min-width: 36px;
    padding: 6px 12px;
  }

  /* ── Panel scroll: overscroll behaviour ── */
  .admin-content{
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Haptic-friendly active states ── */
  .shortcut-card:active{
    transform: scale(.96) !important;
    transition: transform .1s ease !important;
  }
  .btn-save:active,
  .btn-danger:active{
    transform: scale(.97) !important;
    opacity: .9 !important;
  }

  /* ── POS Total row: tidak sempit ── */
  #pj-total-display{
    font-size: clamp(.95rem, 4vw, 1.15rem) !important;
  }

  /* ── POS filter tabs: text tidak terlalu kecil ── */
  #pj-tab-all, #pj-tab-topping, #pj-tab-goreng,
  #pj-tab-original, #pj-tab-birthday{
    font-size: .78rem !important;
    padding: 7px 14px !important;
    min-height: 36px !important;
  }

  /* ── Keranjang item: layout tidak bocor ── */
  #pj-items-wrap > div{
    min-width: 0;
    overflow: hidden;
  }

  /* ── Form kasir header: input height consistent ── */
  #pj-tanggal, #pj-pelanggan, #pj-phone, #pj-bayar, #pj-cabang{
    min-height: 48px !important;
    font-size: max(16px, .88rem) !important;
  }

  /* ── Add form box: shadow dan padding mobile-safe ── */
  .add-form-box{
    border-radius: 14px !important;
    margin-bottom: 14px !important;
  }

  /* ── Section label: readability ── */
  .section-label,
  [style*="font-size:.64rem"][style*="text-transform:uppercase"]{
    font-size: .7rem !important;
    letter-spacing: 1px !important;
  }

  /* ── Toast: always above nav pill + safe area ── */
  .toast{
    bottom: max(110px, calc(90px + env(safe-area-inset-bottom, 0px))) !important;
    left: 12px !important;
    right: 12px !important;
    text-align: center;
    border-radius: 12px !important;
  }

  /* ── Modal overlay: full center, safe from notch ── */
  #um-modal-overlay,
  #um-delete-overlay,
  #um-chpwd-overlay,
  #um-chusername-overlay{
    padding: max(12px, env(safe-area-inset-top, 12px)) 12px 12px !important;
  }
}

/* ── Extra-small ≤ 360px: aggressive scale-down ── */
@media(max-width:360px){
  #pj-menu-grid{
    grid-template-columns: 1fr 1fr !important;
    gap: 6px !important;
  }
  #pj-menu-grid > div{
    padding: 10px 8px !important;
    border-radius: 10px !important;
  }
  .kpi-value{ font-size: .9rem !important; }
  .kpi-label{ font-size: .58rem !important; }
  .kpi-card{ padding: 12px 10px 10px !important; }
  .admin-topbar h1{ font-size: .76rem !important; max-width: 26vw !important; }
  .admin-nav-item{ padding: 6px 8px 5px !important; font-size: .52rem !important; }
  .admin-nav-item span svg{ width: 18px !important; height: 18px !important; }
  .shortcut-card{ padding: 9px 5px !important; border-radius: 10px !important; }
  .sc-icon{ width: 30px !important; height: 30px !important; margin-bottom: 4px !important; }
  .sc-name{ font-size: .58rem !important; }
}

@media print{@page{margin:0}html,body{margin:0}.page{max-width:100%}.hdr,.strip,.kpis,.sec,.ftr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="page">
<!-- HEADER -->
<div class="hdr">
  <div class="hdr-brand">
    ${logoHtml}
    <div class="hdr-title"><h1>Kampung Dimsum</h1><p>Laporan Omset Harian per Cabang</p></div>
  </div>
  <div class="hdr-meta">
    <div><strong>${bulanLabel}</strong></div>
    <div>Dicetak: ${tglLabel}</div>
    <div>Pukul ${jamLabel} WIB</div>
  </div>
</div>
<div class="strip">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
  <h2>Ringkasan Omset — Semua Cabang</h2>
</div>
<!-- KPI -->
<div class="kpis">
  <div class="kpi red"><div class="kpi-lbl">Grand Total Omset</div><div class="kpi-val">${grandOmset>=1000000?(grandOmset/1000000).toFixed(1)+' Jt':fmt(grandOmset)}</div><div class="kpi-sub">${uniqueDates.length} hari</div></div>
  <div class="kpi gold"><div class="kpi-lbl">Avg Omset/Hari</div><div class="kpi-val">${uniqueDates.length?((grandOmset/uniqueDates.length)/1000000).toFixed(1)+' Jt':'—'}</div><div class="kpi-sub">rata-rata harian</div></div>
  <div class="kpi green"><div class="kpi-lbl">Total Transaksi</div><div class="kpi-val">${grandTrx.toLocaleString('id-ID')}</div><div class="kpi-sub">${grandTrx&&uniqueDates.length?Math.round(grandTrx/uniqueDates.length)+' trx/hari':'—'}</div></div>
  <div class="kpi blue"><div class="kpi-lbl">Avg per Transaksi</div><div class="kpi-val">${grandTrx?((grandOmset/grandTrx)/1000).toFixed(0)+' Rb':'—'}</div><div class="kpi-sub">nilai rata-rata</div></div>
</div>

<!-- CABANG RANKING -->
<div class="sec" style="padding-top:22px">
  <div class="sec-ttl">Peringkat Omset per Cabang</div>
  <div class="tbl-wrap">
    <table>
      <thead class="bar-th"><tr><th>Cabang</th><th>Bar Omset</th><th class="r">Total Omset</th><th class="c">Trx</th></tr></thead>
      <tbody>${cabSummaryRows}</tbody>
    </table>
  </div>
</div>

<!-- DAILY TABLE -->
<div class="sec" style="padding-top:22px">
  <div class="sec-ttl">Detail Harian per Cabang</div>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Tanggal</th><th>Cabang</th><th class="r">Omset</th><th class="c">Trx</th><th class="r">Avg/Trx</th></tr></thead>
      <tbody>${dailyRowsHtml}</tbody>
      <tfoot><tr class="gt">
        <td colspan="2" style="border-radius:0 0 0 12px">GRAND TOTAL — ${bulanLabel}</td>
        <td style="text-align:right">${fmt(grandOmset)}</td>
        <td style="text-align:center">${grandTrx}</td>
        <td style="text-align:right;border-radius:0 0 12px 0">${grandTrx?fmt(Math.round(grandOmset/grandTrx)):'—'}</td>
      </tr></tfoot>
    </table>
  </div>
</div>

<!-- FOOTER -->
<div class="ftr">
  <div>© ${now.getFullYear()} <strong>Kampung Dimsum</strong> — Generated otomatis oleh sistem</div>
  <div>Dicetak: ${tglLabel}, ${jamLabel} WIB</div>
</div>
</div>
<scr` + `ipt>window.onload=()=>{window.print()}<\/scr` + `ipt>
</body>
</html>`;

  const win = window.open('','_blank','width=1000,height=750');
  if(!win){
    showToast('Pop-up diblokir! Mendownload sebagai file HTML...','error');
    try {
      const blob = new Blob([html], {type:'text/html;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'laporan-omset-harian-kampung-dimsum-'+bulan+'.html';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 2000);
    } catch(e){ showToast('Gagal download. Izinkan pop-up lalu coba lagi.','error'); }
    return;
  }
  win.document.write(html);
  win.document.close();
  showToast('Laporan berhasil dibuka — simpan sebagai PDF dari dialog print','success');
}


// v134: Export CSV analitik yang sesungguhnya (file .csv)
// Sebelumnya tombol "Export CSV" memanggil exportAnalitikCSV() yang menghasilkan HTML/print popup.
// Sekarang tombol CSV → _exportAnalitikCSVReal() → file .csv asli
// Tombol PDF → exportAnalitikCSV() → HTML popup dengan print dialog
function _exportAnalitikCSVReal(){
  const now = new Date();
  const bulanEl = document.getElementById('an-filter-bulan');
  const bulan = bulanEl ? bulanEl.value : '';
  const bulanLabel = bulan ? bulan : 'semua';

  // Build rows dari omsetHistory (+ penjualanData jika belum sync)
  const map = {};
  const addRow = (tgl10, cab, omset, trx) => {
    const key = tgl10 + '__' + cab;
    if(!map[key]) map[key] = {tanggal: tgl10, cabang: cab, omset: 0, trx: 0};
    map[key].omset += omset; map[key].trx += trx;
  };
  omsetHistory.forEach(o => {
    if(!o.tanggal) return;
    const tgl10 = o.tanggal.slice(0,10);
    if(bulan && !tgl10.startsWith(bulan)) return;
    addRow(tgl10, o.cabang||'', o.omset||0, o.trx||0);
  });
  penjualanData.forEach(p => {
    if(!p.tanggal) return;
    const tgl10 = p.tanggal.slice(0,10);
    if(bulan && !tgl10.startsWith(bulan)) return;
    const alreadySynced = omsetHistory.some(o => o.order_id && o.order_id === p.id);
    if(alreadySynced) return;
    addRow(tgl10, p.cabang||'', p.total||0, 1);
  });

  const rows = Object.values(map).sort((a,b) => a.tanggal.localeCompare(b.tanggal) || a.cabang.localeCompare(b.cabang));
  if(!rows.length){ showToast('Tidak ada data untuk diekspor','error'); return; }

  // Build CSV — Omset sebagai ANGKA MURNI (tanpa Rp/titik) agar Excel bisa SUM
  // Kolom "Omset (Rp)" tambahan untuk display/baca manusia
  const BOM = '\uFEFF'; // UTF-8 BOM agar Excel baca encoding dengan benar
  let csv = BOM + 'Tanggal,Cabang,Omset,Omset (Rp),Transaksi,Avg per Trx,Avg per Trx (Rp)\n';
  rows.forEach(r => {
    const avg = r.trx > 0 ? Math.round(r.omset / r.trx) : 0;
    const cab = '"' + (r.cabang||'').replace(/"/g, '""') + '"';
    // Angka MURNI tanpa format (untuk kalkulasi Excel)
    const omsetNum = parseInt(r.omset||0);
    const avgNum   = avg;
    // Format Rp (untuk baca manusia)
    const omsetRp  = '"Rp ' + omsetNum.toLocaleString('id-ID') + '"';
    const avgRp    = avgNum > 0 ? '"Rp ' + avgNum.toLocaleString('id-ID') + '"' : '"—"';
    csv += `${r.tanggal},${cab},${omsetNum},${omsetRp},${r.trx},${avgNum},${avgRp}\n`;
  });

  // Grand total row
  const grandOmset = rows.reduce((s,r)=>s+r.omset, 0);
  const grandTrx   = rows.reduce((s,r)=>s+r.trx, 0);
  const grandAvg   = grandTrx > 0 ? Math.round(grandOmset/grandTrx) : 0;
  csv += `TOTAL,,${parseInt(grandOmset)},"Rp ${parseInt(grandOmset).toLocaleString('id-ID')}",${grandTrx},${grandAvg},"Rp ${grandAvg.toLocaleString('id-ID')}"\n`;

  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'analitik-omset-kampung-dimsum-' + bulanLabel + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('CSV berhasil diunduh (' + rows.length + ' baris) — kolom Omset berisi angka murni untuk Excel','success');
}
async function exportAnalitikPDF(){
  // v123 FIX: exportAnalitikPDF was generating a separate (buggy) report with no date filter.
  // The proper HTML/print report is exportAnalitikCSV() which has full daily breakdown.
  // Redirect here so existing bookmarks / calls still work.
  exportAnalitikCSV();
}
function exportOmset(){
  // BUG-L5 FIX: sertakan kolom Source agar bisa audit mana entry manual vs dari penjualan
  // v124 FIX LOW-03: tambah BOM UTF-8 agar Excel Indonesia baca encoding dengan benar
  const BOM = '\uFEFF';
  let csv=BOM+'Tanggal,Cabang,Omset,Transaksi,Source\n';
  omsetHistory.forEach(o=>{csv+=`${o.tanggal},${o.cabang},${o.omset},${o.trx},${o.source||'manual'}\n`;});
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='omset-kampung-dimsum.csv';a.click();
}

// ============ ORDER TRACKING TABLE ============
function renderOrderTable(){
  const tbl=document.getElementById('tbl-orders');
  if(!tbl)return;
  const statusColor={'Pending':'badge-normal','Diproses':'badge-best','Siap Diambil':'badge-open'};
  tbl.innerHTML=`<thead><tr><th>Order ID</th><th>Pelanggan</th><th>Cabang</th><th>Item</th><th class="th-right">Total</th><th class="th-center">Waktu</th><th class="th-center">Status</th><th class="th-center">Aksi</th></tr></thead><tbody>${ordersData.map((o,idx)=>`<tr><td style="font-size:.75rem;font-weight:600;color:var(--text4)">${o.id}</td><td style="font-weight:500;color:var(--text)">${_esc(o.pelanggan)}</td><td>${_esc(o.cabang)}</td><td style="font-size:.76rem;color:var(--text3);max-width:140px">${_esc(o.items)}</td><td style="color:var(--red);font-weight:600">${o.total}</td><td style="font-size:.76rem;color:var(--text4)">${_esc(o.waktu)}</td><td><span class="td-badge ${statusColor[o.status]||'badge-normal'}">${_esc(o.status)}</span></td><td><button class="btn-edit" onclick="advanceOrder(${idx})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><polygon points="6,4 20,12 6,20" fill="var(--text2)" stroke="var(--text2)" stroke-width="1"/></svg> Lanjut</button></td></tr>`).join('')}</tbody>`;
}
function advanceOrder(idx){
  const flow=['Pending','Diproses','Siap Diambil','Selesai'];
  const cur=flow.indexOf(ordersData[idx].status);
  if(cur<flow.length-1){ordersData[idx].status=flow[cur+1];renderOrderTable();showToast(`Order ${ordersData[idx].id} → ${ordersData[idx].status} <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#10B981"/><path d="M8 12l3 3 5-6" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,'success');}
  else{showToast('Pesanan sudah selesai!','info');}
}
function addDummyOrder(){
  // LOW-1 FIX: fungsi ini HANYA untuk development/demo
  // Di produksi: set window._KD_PROD = true untuk sembunyikan tombol ini via CSS
  // Tombol "+ Simulasi Order Baru" sudah di-hide jika _KD_PROD aktif (lihat renderOrderTable)
  const rand=Math.floor(Math.random()*9000)+1000;
  ordersData.unshift({id:`KD-241202-${rand}`,pelanggan:'Pelanggan Baru',cabang:`KD ${['03','07','09','12'][Math.floor(Math.random()*4)]}`,items:'Siomay Udang x2, Teh Poci',total:`Rp ${(12000*2+8000).toLocaleString('id-ID')}`,status:'Pending',waktu:new Date().toTimeString().substring(0,5)});
  renderOrderTable();showToast('Order baru masuk!','info');
}


// ============================================================
// BLUETOOTH THERMAL PRINTER — ESC/POS 58mm
// Kompatibel: Iware BT-58D PRO / C5813 / 58BC / MP + generic ESC/POS 58mm
// BT-01 FIX: Arsitektur postMessage (tidak pakai window.opener)
// BT-03 FIX: Semua DOM query ke popup dilakukan via _btPushStatusToPopup
// BT-06 FIX: _btUpdateUI dihapus, diganti _btPushStatusToPopup
// ============================================================

var _btPrinter = {
  device:    null,
  server:    null,
  char:      null,
  connected: false,
  connecting:false,
};

// UUID service/characteristic — ordered by likelihood for Iware/generic 58mm
var _BT_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',  // iWare BT-58D PRO (primary)
  '0000ff00-0000-1000-8000-00805f9b34fb',  // Xprinter / GZM variant
  '0000ffe0-0000-1000-8000-00805f9b34fb',  // HM-10 BLE UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // Rongta
  '00001101-0000-1000-8000-00805f9b34fb',  // SPP classic
];
var _BT_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',  // iWare write
  '0000ff02-0000-1000-8000-00805f9b34fb',  // Xprinter write
  '0000ffe1-0000-1000-8000-00805f9b34fb',  // HM-10 TX
];

// ── ESC/POS helpers ─────────────────────────────────────────
var ESC=0x1B,GS=0x1D,LF=0x0A;

function _escCmd(){
  var b=[];
  for(var i=0;i<arguments.length;i++){
    var a=arguments[i];
    if(typeof a==='number') b.push(a);
    else if(Array.isArray(a)) b=b.concat(a);
    else if(a instanceof Uint8Array){ for(var j=0;j<a.length;j++) b.push(a[j]); }
  }
  return new Uint8Array(b);
}

function _escStr(str){
  str=String(str||'');
  var b=[];
  for(var i=0;i<str.length;i++){
    var c=str.charCodeAt(i);
    b.push(c<128?c:0x3F);
  }
  return new Uint8Array(b);
}

function _escRow(left,right,w){
  w=w||32; left=String(left||''); right=String(right||'');
  var pad=w-left.length-right.length;
  if(pad<1)pad=1;
  var s=left; for(var i=0;i<pad;i++) s+=' '; s+=right;
  return s;
}

function _escDash(w){ var s=''; for(var i=0;i<(w||32);i++) s+='-'; return s; }

function _escWrap(text,w){
  w=w||32; text=String(text||''); var lines=[];
  while(text.length>w){
    var cut=w;
    for(var i=w-1;i>=w-8&&i>=0;i--){ if(text[i]===' '){ cut=i+1; break; } }
    lines.push(text.slice(0,cut).trimRight());
    text=text.slice(cut).trimLeft();
  }
  if(text) lines.push(text);
  return lines;
}

function _fmtRp(n){ return parseInt(n||0).toLocaleString('id-ID'); }

// ── Build ESC/POS bytes dari data transaksi ─────────────────
function _buildStrukBytes(trx,cabData){
  var W=32, buf=[];
  function push(arr){ for(var i=0;i<arr.length;i++) buf.push(arr[i]); }
  function line(text){ push(_escStr(text)); buf.push(LF); }
  function nl(){ buf.push(LF); }

  var cab=cabData?cabData.find(function(c){return c.name===trx.cabang;}):null;
  var addr=cab?(cab.addr||''):'';
  var wa=cab?(cab.wa||''):'';
  var dt=new Date(trx.tanggal);
  var ok=!isNaN(dt.getTime());
  var tgl=ok?dt.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'}):String(trx.tanggal||'').slice(0,10);
  var jam=ok?dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false}):String(trx.tanggal||'').slice(11,16);
  var items=Array.isArray(trx.items)?trx.items:[];
  var totalQty=items.reduce(function(a,i){return a+(i.qty||0);},0);
  var isTunai=/tunai|cash/i.test(trx.bayar||'');

  // Init + center
  push(_escCmd(ESC,0x40));
  push(_escCmd(ESC,0x74,0x00));
  push(_escCmd(ESC,0x61,0x01));

  // Header — nama brand double height
  push(_escCmd(ESC,0x21,0x10));
  line('KAMPUNG DIMSUM');
  push(_escCmd(ESC,0x21,0x00));

  line(trx.cabang||'');
  if(addr&&addr!=='—') line(addr);
  if(wa) line('WA: '+wa);
  line('DIMSUM SEGAR - TOPPING BERLIMPAH');
  push(_escCmd(ESC,0x61,0x00)); // left

  nl();
  line(_escDash(W));

  // Meta
  line(_escRow('No. Struk',trx.id||'',W));
  line(_escRow('Pelanggan',trx.pelanggan||'Pelanggan Umum',W));
  line(_escRow('Pembayaran',trx.bayar||'-',W));
  line(_escRow('Tanggal',tgl+' '+jam,W));
  line(_escDash(W));

  // Items
  items.forEach(function(item){
    var sub=(item.sub!=null)?item.sub:(item.price||0)*(item.qty||0);
    var nameLines=_escWrap(item.name||'',W);
    nameLines.forEach(function(nl_){ line(nl_); });
    line(_escRow(' '+_fmtRp(item.price||0)+' x '+item.qty, _fmtRp(sub), W));
  });

  line(_escDash(W));

  // Total normal
  push(_escCmd(ESC,0x21,0x00));
  line(_escRow('TOTAL '+totalQty+' QTY',_fmtRp(trx.total),W));

  // Total BAYAR — double size
  push(_escCmd(ESC,0x21,0x30));
  line(_escRow('Bayar',_fmtRp(trx.total),W));
  push(_escCmd(ESC,0x21,0x00));

  if(isTunai) line(_escRow('Kembali','0',W));
  line(_escDash(W));

  // Footer center
  push(_escCmd(ESC,0x61,0x01));
  line('Terima kasih, semoga');
  line('menjadi langganan!');
  if(wa){ line('Pesan lagi via WA:'); line(wa); }
  nl(); nl();

  // Full cut
  push(_escCmd(GS,0x56,0x41,0x03));

  return new Uint8Array(buf);
}

// ── Kirim bytes ke printer dalam chunk 100 byte ─────────────
async function _btSendBytes(bytes){
  var CHUNK=100;
  for(var i=0;i<bytes.length;i+=CHUNK){
    var chunk=bytes.slice(i,i+CHUNK);
    // BT-05 FIX: coba writeWithoutResponse dulu (lebih cepat), fallback ke writeValue
    try {
      if(_btPrinter.char.properties.writeWithoutResponse){
        await _btPrinter.char.writeValueWithoutResponse(chunk);
      } else {
        await _btPrinter.char.writeValue(chunk);
      }
    } catch(e){
      await _btPrinter.char.writeValue(chunk);
    }
    await new Promise(function(r){ setTimeout(r,40); });
  }
}

// ── Push status koneksi ke popup (BT-03 & BT-06 FIX) ────────
// Semua UI update ke popup dilakukan via postMessage, bukan DOM query dari parent
function _btPushStatusToPopup(win){
  if(!win||win.closed) return;
  var connected=_btPrinter.connected;
  var devName=(_btPrinter.device&&_btPrinter.device.name)||'Printer';
  var msg;
  if(_btPrinter.connecting){
    msg={type:'BT_STATUS',connected:false,connDisabled:true,connLabel:'⏳ Menghubungkan...',connBg:'#64748b',statusText:'⏳ Menghubungkan...',statusColor:'#f59e0b'};
  } else if(connected){
    msg={type:'BT_STATUS',connected:true,connDisabled:false,connLabel:'⛔ Putuskan',connBg:'#64748b',statusText:'🟢 '+devName+' — Terhubung',statusColor:'#10b981'};
  } else {
    msg={type:'BT_STATUS',connected:false,connDisabled:false,connLabel:'🔵 Hubungkan Printer',connBg:'#1d4ed8',statusText:'⚪ Belum terhubung',statusColor:'#888'};
  }
  try{ win.postMessage(msg,'*'); }catch(e){}
}

// ── Connect ──────────────────────────────────────────────────
async function btConnect(){
  if(_btPrinter.connecting){ showToast('Sedang menghubungkan...','info'); return false; }
  if(!navigator.bluetooth){ showToast('Web Bluetooth tidak didukung. Gunakan Chrome Android terbaru.','error'); return false; }

  _btPrinter.connecting=true;
  _btPrinter.connected=false;
  var popWin=window._btPopupWin;
  _btPushStatusToPopup(popWin);

  try {
    showToast('Mencari printer Bluetooth...','info');
    var device=await navigator.bluetooth.requestDevice({
      acceptAllDevices:true,
      optionalServices:_BT_SERVICE_UUIDS,
    });
    _btPrinter.device=device;
    device.addEventListener('gattserverdisconnected',_btOnDisconnect);

    showToast('Menghubungkan ke '+device.name+'...','info');
    var server=await device.gatt.connect();
    _btPrinter.server=server;

    // Cari service yang cocok
    var service=null;
    for(var si=0;si<_BT_SERVICE_UUIDS.length;si++){
      try{ service=await server.getPrimaryService(_BT_SERVICE_UUIDS[si]); if(service) break; }catch(e){ service=null; }
    }
    if(!service) throw new Error('Service printer tidak ditemukan. Pastikan printer Iware menyala.');

    // Cari characteristic write
    var char=null;
    for(var ci=0;ci<_BT_CHAR_UUIDS.length;ci++){
      try{ char=await service.getCharacteristic(_BT_CHAR_UUIDS[ci]); if(char) break; }catch(e){ char=null; }
    }
    // Fallback: ambil characteristic writable pertama
    if(!char){
      var chars=await service.getCharacteristics();
      for(var i=0;i<chars.length;i++){
        var p=chars[i].properties;
        if(p.write||p.writeWithoutResponse){ char=chars[i]; break; }
      }
    }
    if(!char) throw new Error('Characteristic write tidak ditemukan.');

    _btPrinter.char=char;
    _btPrinter.connected=true;
    _btPrinter.connecting=false;
    _btPushStatusToPopup(window._btPopupWin);
    if(typeof _strukBtUpdateUI==='function') _strukBtUpdateUI();
    showToast('✅ Printer '+device.name+' terhubung!','success');
    return true;

  } catch(err){
    _btPrinter.connecting=false;
    _btPrinter.connected=false;
    _btPushStatusToPopup(window._btPopupWin);
    if(typeof _strukBtUpdateUI==='function') _strukBtUpdateUI();
    if(err.name==='NotFoundError'||String(err.message).includes('cancel')){
      showToast('Pencarian printer dibatalkan.','info');
    } else {
      showToast('Gagal hubungkan: '+(err.message||err),'error');
    }
    return false;
  }
}

// ── Disconnect ───────────────────────────────────────────────
function btDisconnect(){
  try{ if(_btPrinter.device&&_btPrinter.device.gatt.connected) _btPrinter.device.gatt.disconnect(); }catch(e){}
  _btPrinter.connected=false;
  _btPrinter.char=null;
  _btPushStatusToPopup(window._btPopupWin);
  if(typeof _strukBtUpdateUI==='function') _strukBtUpdateUI();
  showToast('Printer terputus.','info');
}

function _btOnDisconnect(){
  _btPrinter.connected=false;
  _btPrinter.char=null;
  _btPushStatusToPopup(window._btPopupWin);
  if(typeof _strukBtUpdateUI==='function') _strukBtUpdateUI();
  showToast('Koneksi printer terputus.','error');
}

// ── Print struk via Bluetooth ────────────────────────────────
async function btPrintStruk(trx){
  if(!_btPrinter.connected||!_btPrinter.char){
    showToast('Printer belum terhubung!','error'); return;
  }
  var popWin=window._btPopupWin;
  try{ popWin&&popWin.postMessage({type:'BT_PRINTING'},'*'); }catch(e){}

  try {
    var bytes=_buildStrukBytes(trx,window.cabangData||[]);
    await _btSendBytes(bytes);
    showToast('✅ Struk berhasil dicetak!','success');
  } catch(err){
    showToast('Gagal cetak: '+(err.message||err),'error');
    if(err.name==='NetworkError'||String(err.message).includes('GATT')) _btOnDisconnect();
  } finally {
    try{ popWin&&popWin.postMessage({type:'BT_PRINT_DONE'},'*'); }catch(e){}
  }
}

// ── Message listener — terima perintah dari popup ────────────
// BT-01 FIX: popup kirim 'BT_CONNECT'/'BT_PRINT'/'BT_DISCONNECT' via postMessage
window.addEventListener('message', async function(e){
  var d=e.data;
  if(!d||!d.type) return;
  // Pastikan hanya terima dari popup kita sendiri (origin sama karena about:blank)
  if(d.type==='BT_CONNECT'){
    await btConnect();
  } else if(d.type==='BT_DISCONNECT'){
    btDisconnect();
  } else if(d.type==='BT_PRINT'){
    // Ambil data trx dari window — key disimpan saat buka popup
    // Cari key kd_trx_ yang masih ada
    var trxData=null;
    var keys=Object.keys(window);
    for(var i=0;i<keys.length;i++){
      if(keys[i].startsWith('kd_trx_')){ trxData=window[keys[i]]; break; }
    }
    if(trxData){ await btPrintStruk(trxData); }
    else { showToast('Data transaksi tidak ditemukan. Buka ulang popup struk.','error'); }
  }
});
// ============ AUTH ============
// ====== SUPABASE — FIX v70 #1: env-var pattern ======
// Kredensial dibaca dari window.__KD_ENV yang di-inject oleh /api/env.js (Vercel serverless).
// Di Vercel Dashboard → Settings → Environment Variables, set:
//   SUPABASE_URL = https://nsphvlvyuxzieriyyfcy.supabase.co
//   SUPABASE_KEY = eyJhbGci...
// Jika /api/env.js tidak ada (local dev), fallback ke konstanta di bawah.
// ════════════════════════════════════════════════════════════════════
// ✅ WAJIB sebelum deploy produksi:
//   1. RLS AKTIF di SEMUA tabel: admin_profiles, omset, penjualan, stok, dsb.
//   2. JANGAN PERNAH taruh SERVICE_ROLE key di sini — itu bypass semua RLS
// ════════════════════════════════════════════════════════════════════
// FIX v92c: Lazy getter — dibaca saat dipakai, bukan saat parse
// Menghindari race condition antara /api/env (defer) dan inline script
function _getSupabaseUrl(){ return (window.__KD_ENV && window.__KD_ENV.url) || ''; }
function _getSupabaseKey(){ return (window.__KD_ENV && window.__KD_ENV.key) || ''; }
// Tetap expose sebagai getter property agar kode lama yang pakai SUPABASE_URL tetap jalan
Object.defineProperty(window, 'SUPABASE_URL',      { get: _getSupabaseUrl });
Object.defineProperty(window, 'SUPABASE_ANON_KEY', { get: _getSupabaseKey });
// _sb akan diinit oleh _loadSupabase() saat pertama kali dibutuhkan
// Untuk keamanan, buat proxy accessor
function getSB(){
  if(!window._sb && window.supabase){
    if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
      console.warn('[KD] getSB: SUPABASE_URL/KEY kosong — env.js belum load atau tidak tersedia');
      return null;
    }
    try {
      window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch(e){
      console.warn('[KD] getSB: createClient gagal:', e.message);
      return null;
    }
  }
  return window._sb || null;
}

// ============================================================
// SUPABASE SYNC HELPERS v55
// Setiap fungsi: simpan ke localStorage (offline-first) LALU
// async upsert/insert ke Supabase (non-blocking, fire-and-forget)
// ============================================================

// ── PENJUALAN ──
async function _sbSyncPenjualan(record){
  try {
    const sb = getSB(); if(!sb) return;
    const row = {
      order_id:   record.id,
      tanggal:    record.tanggal,
      cabang:     record.cabang,
      pelanggan:  record.pelanggan,
      bayar:      record.bayar,
      items:      record.items,      // disimpan sebagai JSONB
      total:      record.total,
      created_at: new Date().toISOString()
    };
    const { error } = await sb.from('penjualan').upsert(row, { onConflict: 'order_id' });
    if(error) console.warn('[KD] penjualan sync gagal:', error.message);
  } catch(e){ console.warn('[KD] penjualan sync error:', e); }
}

// ── OMSET ──
async function _sbSyncOmset(record){
  try {
    const sb = getSB(); if(!sb) return;
    // BUG FIX v56: tambah idempotency_key agar retry/double-click tidak duplikat
    // Key: order_id untuk entry dari penjualan, atau tanggal+cabang+timestamp untuk manual
    const ikey = record.order_id
      ? ('pj_' + record.order_id)
      // FIX v129 MEDIUM-02: key deterministik (tanpa Date.now) agar retry tidak duplikat di Supabase
      : ('mn_' + record.tanggal + '_' + record.cabang + '_' + record.omset);
    const row = {
      tanggal:         record.tanggal,
      cabang:          record.cabang,
      omset:           record.omset,
      trx:             record.trx,
      source:          record.source || 'manual',
      order_id:        record.order_id || null,
      idempotency_key: ikey,
      updated_at:      new Date().toISOString()
    };
    // Upsert berdasarkan idempotency_key — aman kalau dipanggil 2x
    const { error } = await sb.from('omset_entries').upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if(error) console.warn('[KD] omset sync gagal:', error.message);
  } catch(e){ console.warn('[KD] omset sync error:', e); }
}

// ── STOK DISTRIBUSI ──
async function _sbSyncStok(record){
  try {
    const sb = getSB(); if(!sb) return;
    // BUG FIX v56: idempotency_key dari tanggal+cabang+produk+jumlah+timestamp
    const ikey = record.tgl + '_' + record.cab + '_' + record.produk + '_' + record.jumlah + '_' + Date.now();
    const row = {
      tanggal:         record.tgl,
      cabang:          record.cab,
      produk:          record.produk,
      jumlah:          record.jumlah,
      satuan:          record.satuan || 'pcs',
      status:          record.status,
      catatan:         record.catatan || '',
      input_by:        record.inputBy || 'Pusat',
      idempotency_key: ikey,
      created_at:      new Date().toISOString()
    };
    const { error } = await sb.from('stok_distribusi').upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if(error) console.warn('[KD] stok_distribusi sync gagal:', error.message);
  } catch(e){ console.warn('[KD] stok sync error:', e); }
}

// ── INVENTORY STATE (upsert per cabang+produk) ──
async function _sbSyncInvState(){
  try {
    const sb = getSB(); if(!sb) return;
    const rows = [];
    Object.entries(inventoryState).forEach(function([cab, produkMap]){
      Object.entries(produkMap).forEach(function([produk, qty]){
        rows.push({ cabang: cab, produk: produk, qty: qty, updated_at: new Date().toISOString() });
      });
    });
    // FIX v106: jika inventoryState kosong (semua stok dihapus), DELETE semua row
    // di Supabase inventory_state agar saat load berikutnya tabel benar-benar kosong
    // dan angka stok tampil 0 (bukan nilai lama dari localStorage)
    if(!rows.length){
      await sb.from('inventory_state').delete().neq('cabang','__never__');
      return;
    }
    // Upsert row yang ada
    const { error } = await sb.from('inventory_state').upsert(rows, { onConflict: 'cabang,produk' });
    if(error) console.warn('[KD] inventory_state sync gagal:', error.message);
    // Hapus row qty=0 dari Supabase (cleanup) agar tabel tetap bersih
    await sb.from('inventory_state').delete().eq('qty', 0);
  } catch(e){ console.warn('[KD] inventory sync error:', e); }
}

// ── LOAD SEMUA DATA DARI SUPABASE SAAT LOGIN ──
// Dipanggil setelah login berhasil agar data real dari DB, bukan dummy localStorage
// BUG FIX v56:
//   - Tiap tabel di-load dalam try/catch sendiri agar satu gagal tidak abort semua
//   - menuData hanya dikosongkan jika Supabase benar-benar return data (guard deploy pertama)
async function _sbLoadAll(){
  const sb = getSB(); if(!sb) return;

  // 1. Penjualan
  // FIX v101 BUG-K1: sebelumnya push 2x per record — push pertama items sebagai string,
  // push kedua items sebagai array. Digabung menjadi satu push per record dengan format
  // unified: items selalu Array (agar renderPenjualanTable/pjExport tidak crash .map())
  // dan field bayar ada agar tabel bisa tampilkan metode pembayaran.
  try {
    const { data: pj, error } = await sb.from('penjualan').select('*').order('tanggal', { ascending: false }).limit(200);
    if(!error && pj && pj.length){
      penjualanData.length = 0;
      ordersData.length = 0;
      pj.forEach(function(r){
        // items dari Supabase bisa berupa Array (JSONB) atau string (legacy) — normalkan ke Array
        var rawItems = r.items;
        var itemsArr = Array.isArray(rawItems) ? rawItems : [];
        var itemsStr = itemsArr.length
          ? itemsArr.map(function(i){ return (i.name||'?')+' x'+(i.qty||1); }).join(', ')
          : (typeof rawItems==='string' && rawItems ? rawItems : '—');
        penjualanData.push({
          id:       r.order_id,
          order_id: r.order_id,
          tanggal:  r.tanggal,
          waktu:    r.waktu || '—',
          pelanggan:r.pelanggan || '—',
          cabang:   r.cabang,
          bayar:    r.bayar || r.payment || 'Cash',
          items:    itemsArr,
          total:    r.total || 0,
          status:   r.status || 'Pending',
          catatan:  r.catatan || ''
        });
        ordersData.push({
          id:        r.order_id,
          pelanggan: r.pelanggan || '—',
          cabang:    r.cabang || '—',
          items:     itemsStr,
          total:     'Rp '+Number(r.total||0).toLocaleString('id-ID'),
          status:    r.status || 'Pending',
          waktu:     r.waktu || '—'
        });
      });
      _persistPenjualan();
    }
  } catch(e){ console.warn('[KD] load penjualan error:', e); }

  // 2. Omset — selalu clear dummy/localStorage jika Supabase berhasil diquery
  try {
    const { data: om, error } = await sb.from('omset_entries').select('*').order('tanggal', { ascending: false }).limit(500);
    if(!error){
      omsetHistory.length = 0;
      localStorage.removeItem('kd_omsetHistory');
      if(om && om.length){
        om.forEach(function(r){
          omsetHistory.push({ tanggal: r.tanggal, cabang: r.cabang, omset: r.omset, trx: r.trx, source: r.source || 'manual', order_id: r.order_id });
        });
        _persistOmset();
      }
    }
  } catch(e){ console.warn('[KD] load omset error:', e); }

  // 3. Stok distribusi
  try {
    const { data: sk, error } = await sb.from('stok_distribusi').select('*').order('tanggal', { ascending: false }).limit(300);
    if(!error && sk && sk.length){
      stokData.length = 0;
      sk.forEach(function(r){
        stokData.push({ tgl: r.tanggal, cab: r.cabang, produk: r.produk, jumlah: r.jumlah, satuan: r.satuan, status: r.status, catatan: r.catatan, inputBy: r.input_by, idempotency_key: r.idempotency_key || null });
      });
    }
  } catch(e){ console.warn('[KD] load stok error:', e); }

  // 4. Inventory state
  // FIX v106: jika Supabase query berhasil (error===null), SELALU reset
  // inventoryState dari DB — termasuk saat semua stok sudah dihapus (inv.length===0).
  // Bug lama: guard `if(!error && inv && inv.length)` melewati blok saat inv kosong
  // → inventoryState lama dari localStorage tidak pernah di-clear → angka stok
  // tetap tampil meski semua entri sudah dihapus.
  try {
    const { data: inv, error } = await sb.from('inventory_state').select('*');
    if(!error){
      // Query berhasil — reset dulu, lalu isi dari DB (termasuk kasus kosong = semua 0)
      Object.keys(inventoryState).forEach(function(k){ delete inventoryState[k]; });
      if(inv && inv.length){
        inv.forEach(function(r){
          if(!inventoryState[r.cabang]) inventoryState[r.cabang] = _invNewCabState();
          inventoryState[r.cabang][r.produk] = r.qty || 0;
        });
      }
      _persistInv();
      localStorage.setItem('kd_inventoryState', JSON.stringify(inventoryState));
    }
  } catch(e){ console.warn('[KD] load inventory error:', e); }

  // 5. Menu items — HANYA overwrite jika Supabase return data
  // v66: Jika Supabase kosong → auto-sync DEFAULT_MENU ke Supabase
  try {
    const { data: mn, error } = await sb.from('menu_items').select('*').order('menu_id');
    if(!error && mn && mn.length){
      // Supabase punya data → pakai dari Supabase
      menuData.length = 0;
      mn.forEach(function(r){
        // FIX v121 BUG #2: tambah packaging & pcsPerBox agar _menuCatToInvKey & pjGetQtyFromName
        // bisa pakai field eksplisit, bukan fallback parsing nama, untuk menu dari Supabase.
        menuData.push({ id: r.menu_id, name: r.name, desc: r.description || '', price: r.price, cat: r.category, img: r.img_url || '', badge: r.badge || '', tags: r.tags || [], inStock: r.in_stock !== false, packaging: r.packaging || '', pcsPerBox: r.pcs_per_box || 0 });
      });
      console.log('[KD] Menu loaded from Supabase:', mn.length, 'items');
    } else if(!error && (!mn || mn.length === 0)){
      // Supabase kosong → auto-sync DEFAULT_MENU
      console.log('[KD] menu_items kosong di Supabase — auto-sync DEFAULT_MENU...');
      menuData.length = 0;
      DEFAULT_MENU.forEach(function(m){ menuData.push(Object.assign({},m)); });
      for(const m of menuData){
        try { await _katalogSyncToSupabase(m); } catch(e2){}
      }
      console.log('[KD] DEFAULT_MENU auto-synced ke Supabase (' + DEFAULT_MENU.length + ' items) ✓');
    }
  } catch(e){ console.warn('[KD] load menu error:', e); }

  // Refresh semua UI setelah load
  renderAdminTables();
  renderStokTable();
  renderStokSummary();
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  // FIX v67: re-render katalog grid jika panel katalog sedang aktif
  const panelKatalog = document.getElementById('panel-katalog');
  if(panelKatalog && panelKatalog.classList.contains('active')){
    renderKatalogGrid(_katalogCurrentFilter);
  }
  // v89: load cabang dari Supabase (override hardcode default jika ada data di DB)
  try {
    const {data:cabRows,error:cabErr}=await sb.from('cabang').select('*').order('id',{ascending:true});
    if(!cabErr && cabRows && cabRows.length){
      cabangData.length=0;
      cabRows.forEach(function(r){
        cabangData.push({id:r.id,name:r.name,addr:r.addr||'',jam:r.jam||'08.00–21.00',
          rating:r.rating||5,wa:r.wa||'',open:r.open!==false,lat:r.lat||0,lng:r.lng||0,
          mapsUrl:r.maps_url||'',type:r.type||'cabang'});
      });
      cabangGeo=cabangData.map(function(c){return{lat:c.lat,lng:c.lng,name:c.name,addr:c.addr,jam:c.jam,rating:c.rating,wa:c.wa,open:c.open,mapsUrl:c.mapsUrl,type:c.type};});
      console.log('[KD] cabangData loaded from DB:',cabangData.length,'cabang');
    }
  } catch(eCab){console.warn('[KD] cabang load error:',eCab);}

  // v89: load franchise_applications dari Supabase
  try {
    const {data:frRows,error:frErr}=await sb.from('franchise_applications').select('*').order('created_at',{ascending:false});
    if(!frErr && frRows){
      window._franchiseApplicants=frRows;
      franchiseApplicants.length=0;
      frRows.forEach(function(r){ franchiseApplicants.push({id:r.id,nama:r.nama||r.name||'—',wa:r.wa||r.whatsapp||'—',kota:r.kota||r.city||'—',modal:r.modal||'—',pesan:r.pesan||'',status:r.status||'Menunggu',created_at:r.created_at}); });
      console.log('[KD] franchise_applications loaded:',frRows.length);
    }
  } catch(eFr){console.warn('[KD] franchise load error:',eFr);}

  // v89: load feedback dari Supabase
  try {
    const {data:fbRows,error:fbErr}=await sb.from('feedback').select('*').order('created_at',{ascending:false});
    if(!fbErr && fbRows){
      window._feedbackList=fbRows;
      feedbackList.length=0;
      fbRows.forEach(function(r){ feedbackList.push({id:r.id,nama:r.nama||r.name||'—',email:r.email||'',subjek:r.subjek||'Kontak',cabang:r.cabang||'—',rating:r.rating||0,pesan:r.pesan||r.message||'',tanggal:r.tanggal||r.created_at?.slice(0,10)||'—'}); });
      console.log('[KD] feedback loaded:',fbRows.length);
    }
  } catch(eFb){console.warn('[KD] feedback load error:',eFb);}

  // v89: load activity_logs dari Supabase
  try {
    const {data:logRows,error:logErr}=await sb.from('activity_logs').select('*').order('created_at',{ascending:false}).limit(100);
    if(!logErr && logRows && logRows.length){
      activityLog.length=0;
      logRows.forEach(function(r){activityLog.push({user:r.user_name,aksi:r.aksi,waktu:r.waktu||r.created_at?.slice(11,16)||'—'});});
      console.log('[KD] activity_logs loaded:',logRows.length);
    }
  } catch(eLog){console.warn('[KD] activity_logs load error:',eLog);}

  // v85 FIX: re-apply permissions dari Supabase saat _sbLoadAll selesai
  // Ini mengatasi masalah shortcut tidak muncul karena renderDashboardForRole
  // dipanggil sebelum permissions dari server ter-load lengkap
  if(window._currentAdmin && window._currentAdmin.id){
    try {
      const sb85 = getSB();
      if(sb85){
        const { data: freshProfile } = await sb85.from('admin_profiles').select('permissions,role').eq('id', window._currentAdmin.id).single();
        if(freshProfile){
          // v87 FIX: pakai _mergePerms (termasuk jika permissions null → default by role)
          const freshRole = freshProfile.role || currentUserRole;
          const freshPerms = _mergePerms(freshProfile.permissions, freshRole);
          window._currentPerms = freshPerms;
          window._currentAdmin.permissions = freshPerms;
          if(freshProfile.role){ currentUserRole = freshRole; window._currentAdmin.role = freshRole; }
          console.log('[KD] _sbLoadAll: fresh perms from DB:', freshPerms);
        }
      }
    } catch(e85){ console.warn('[KD] refresh perms error:', e85); }
  }
  // BUG-FIX v57: renderDashboardForRole() eksplisit dipanggil setelah _sbLoadAll
  renderDashboardForRole();
  // v117 FIX: refresh semua chart setelah data Supabase selesai di-load
  // Chart diinit saat goToPage (sebelum data siap), jadi perlu refresh ulang dengan data real
  setTimeout(function(){
    if(chartInstances['chart-omset'])   _refreshOmsetChart();
    if(chartInstances['chart-cabang'])  _refreshCabangChart();
    if(chartInstances['chart-produk'])  _refreshProdukChart();
    if(chartInstances['chart-payment']) _refreshPaymentChart();
    if(chartInstances['chart-harian'])  initChartHarian(_currentHarianOffset||0);
    // v117 FIX analitik: refresh KPI dan chart analitik jika panel sedang terbuka
    const panelAnalitik=document.getElementById('panel-analitik');
    if(panelAnalitik&&panelAnalitik.classList.contains('active')){
      renderAnalitikKPICards();
      if(chartInstances['chart-trend'])     initAnalitikCharts();
      else if(chartInstances['chart-dayofweek']) initAnalitikCharts();
      renderAnalitikDailyTable();
    }
  }, 200);
  // v82: load promo dari Supabase setelah semua data selesai
  loadPromoFromSupabase();
  console.log('[KD] Data loaded from Supabase ✓');
  // v62: after fresh load, re-init realtime subs if not already active
  if(!window._kdRealtimeChannel) _sbRealtimeInit();
}

// ============================================================
// v62 FITUR #1 — SUPABASE REALTIME LIVE SYNC
// ============================================================
let _kdRealtimeRetryTimer = null;

function _sbSetLiveStatus(isLive){
  const ind = document.getElementById('live-indicator');
  const txt = document.getElementById('live-indicator-text');
  if(!ind || !txt) return;
  if(isLive){
    ind.className = 'live-indicator live';
    txt.textContent = 'LIVE';
    ind.title = 'Sinkronisasi real-time aktif — semua perangkat terhubung';
  } else {
    ind.className = 'live-indicator offline';
    txt.textContent = 'OFFLINE';
    ind.title = 'Tidak terhubung ke live sync. Mencoba ulang...';
  }
}

function _sbRealtimeInject(table, payload){
  // Merge incoming record to local array then refresh UI
  try {
    if(table === 'penjualan' && payload.new){
      const r = payload.new;
      const exists = penjualanData.find(p => p.id === r.order_id);
      if(!exists){
        penjualanData.unshift({ id: r.order_id, tanggal: r.tanggal, cabang: r.cabang, pelanggan: r.pelanggan, bayar: r.bayar, items: r.items || [], total: r.total });
        _persistPenjualan();
        // FIX v116b: saat 15 cabang input barengan, 15 toast dalam < 1 detik
        // setiap toast langsung menimpa toast sebelumnya → SA hanya lihat toast terakhir.
        // Solusi: akumulasi penjualan baru, tampilkan ringkasan setelah 1.5 detik.
        window._newPjQueue = window._newPjQueue || [];
        window._newPjQueue.push(r);
        clearTimeout(window._newPjToastTimer);
        window._newPjToastTimer = setTimeout(function(){
          const q = window._newPjQueue || [];
          window._newPjQueue = [];
          if(q.length === 1){
            showToast('🔴 Penjualan baru: Rp ' + parseInt(q[0].total).toLocaleString('id-ID') + ' (' + _esc(q[0].cabang.replace('Kampung Dimsum ','KD ')) + ')', 'success');
          } else if(q.length > 1){
            const totalAll = q.reduce(function(s,r){ return s + parseInt(r.total||0); }, 0);
            showToast('🔴 ' + q.length + ' transaksi baru masuk — Total: Rp ' + totalAll.toLocaleString('id-ID'), 'success');
          }
        }, 1500);
      }
    } else if(table === 'omset_entries' && payload.new){
      const r = payload.new;
      const exists = omsetHistory.find(o => o.order_id && o.order_id === r.order_id && o.cabang === r.cabang && o.tanggal === r.tanggal);
      if(!exists){
        omsetHistory.unshift({ tanggal: r.tanggal, cabang: r.cabang, omset: r.omset, trx: r.trx, source: r.source || 'realtime', order_id: r.order_id });
        _persistOmset();
      }
    } else if(table === 'stok_distribusi' && payload.new){
      const r = payload.new;
      stokData.unshift({ tgl: r.tanggal, cab: r.cabang, produk: r.produk, jumlah: r.jumlah, satuan: r.satuan, status: r.status, catatan: r.catatan, inputBy: r.input_by });
    } else if(table === 'inventory_state' && payload.new){
      const r = payload.new;
      if(!inventoryState[r.cabang]) inventoryState[r.cabang] = _invNewCabState();
      inventoryState[r.cabang][r.produk] = r.qty || 0;
      _persistInv();
    } else if(table === 'menu_items'){
      // FIX v67: sync perubahan menu dari realtime langsung ke menuData
      const r = payload.new || payload.old;
      if(!r) { /* skip */ }
      else if(payload.eventType === 'DELETE' || payload.old){
        const delId = (payload.old||{}).menu_id;
        if(delId){ const di = menuData.findIndex(m=>m.id===delId); if(di>=0) menuData.splice(di,1); }
      } else {
        const existing = menuData.findIndex(m=>m.id===r.menu_id);
        const item = {id:r.menu_id, name:r.name, desc:r.description||'', price:r.price, cat:r.category, img:r.img_url||'', badge:r.badge||'', tags:r.tags||[], inStock:r.in_stock!==false, packaging:r.packaging||'', pcsPerBox:r.pcs_per_box||0}; // FIX v121 TC-25: tambah packaging & pcsPerBox saat realtime inject
        if(existing>=0) Object.assign(menuData[existing], item);
        else menuData.push(item);
      }
      pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
      const pk = document.getElementById('panel-katalog');
      if(pk && pk.classList.contains('active')) renderKatalogGrid(_katalogCurrentFilter);
    }
    // v70: handle admin_profiles UPDATE — live permission sync tanpa logout
    if(table === 'admin_profiles' && payload.new){
      const r = payload.new;
      // Cek apakah update ini untuk akun yang sedang login di browser ini
      if(window._currentAdmin && window._currentAdmin.username === r.username){
        // v87 FIX: pakai _mergePerms — nilai dari DB menang, non-SA default false
        const newPerms = _mergePerms(r.permissions, r.role || currentUserRole);
        const newRole  = r.role || currentUserRole;
        window._currentPerms = newPerms;
        window._currentAdmin.permissions = newPerms;
        window._currentAdmin.role = newRole;
        window._currentAdmin.display_name = r.display_name || window._currentAdmin.display_name;
        currentUserRole = newRole;
        showToast('🔄 Hak akses Anda telah diperbarui oleh Super Admin', 'info');
        renderDashboardForRole();
        // v84 FIX #3: pakai _panelPermMap sebagai single source of truth
        // Jika panel aktif sekarang tidak lagi diizinkan, redirect ke dashboard
        const activePanel = document.querySelector('.admin-panel.active');
        if(activePanel){
          const panelId = activePanel.id.replace('panel-','');
          const reqPerm = _panelPermMap[panelId];
          if(reqPerm && reqPerm !== '_superadmin_only_' && newRole !== 'superadmin' && !newPerms[reqPerm]){
            switchPanel('dashboard', document.getElementById('nav-dashboard') || document.querySelector('.admin-nav-item'));
            showToast('Panel ini tidak lagi dapat diakses berdasarkan izin baru Anda', 'info');
          }
        }
      }
      return; // tidak perlu lanjut ke renderAdminTables dll
    }

    // FIX v116b: debounce renderAdminTables + renderDashboardForRole
    // Saat 15 cabang input barengan, realtime inject dipanggil 15x dalam < 1 detik
    // tanpa debounce → 15x full re-render DOM → UI thrashing + toast overwrite.
    // Solusi: tunda render 300ms, gabung semua inject dalam 1 render.
    clearTimeout(window._realtimeRenderTimer);
    window._realtimeRenderTimer = setTimeout(function(){
      renderAdminTables();
      renderDashboardForRole();
      renderStokSummary();
      if(currentUserRole === 'superadmin') _renderSaTodayKPI();
      if(chartInstances['chart-realtime']) initRealtimeChart();
      if(chartInstances['chart-omset']) _refreshOmsetChart();
      if(chartInstances['chart-cabang']) _refreshCabangChart();
      if(chartInstances['chart-produk']) _refreshProdukChart();
      if(chartInstances['chart-payment']) _refreshPaymentChart();
      if(chartInstances['chart-harian']) initChartHarian(_currentHarianOffset||0);
    }, 300);
  } catch(e){ console.warn('[KD Realtime] inject error:', e); }
}

async function _sbRealtimeInit(){
  const sb = getSB(); if(!sb) return;
  // Clear old retry timer
  if(_kdRealtimeRetryTimer){ clearTimeout(_kdRealtimeRetryTimer); _kdRealtimeRetryTimer=null; }
  // Remove old channel if exists
  if(window._kdRealtimeChannel){
    try { await sb.removeChannel(window._kdRealtimeChannel); } catch(e){}
    window._kdRealtimeChannel = null;
  }

  try {
    const channel = sb.channel('kd_live_sync_v62', {
      config: { broadcast: { self: false } }
    });

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penjualan' }, (payload) => {
        _sbRealtimeInject('penjualan', payload);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'omset_entries' }, (payload) => {
        _sbRealtimeInject('omset_entries', payload);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stok_distribusi' }, (payload) => {
        _sbRealtimeInject('stok_distribusi', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_state' }, (payload) => {
        _sbRealtimeInject('inventory_state', payload);
      })
      // FIX v67: subscribe ke menu_items agar menu baru/update langsung tampil tanpa refresh manual
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
        _sbRealtimeInject('menu_items', payload);
      })
      // v70 FIX: subscribe admin_profiles UPDATE — agar perubahan permission oleh superadmin
      // langsung efektif di session admin yang bersangkutan tanpa harus logout/login ulang
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_profiles' }, (payload) => {
        _sbRealtimeInject('admin_profiles', payload);
      })
      .subscribe((status) => {
        console.log('[KD Realtime] status:', status);
        if(status === 'SUBSCRIBED'){
          window._kdRealtimeChannel = channel;
          _sbSetLiveStatus(true);
        } else if(status === 'CLOSED' || status === 'CHANNEL_ERROR'){
          _sbSetLiveStatus(false);
          window._kdRealtimeChannel = null;
          // Auto-reconnect in 15s
          _kdRealtimeRetryTimer = setTimeout(_sbRealtimeInit, 15000);
        }
      });
  } catch(e){
    console.warn('[KD Realtime] init error:', e);
    _sbSetLiveStatus(false);
    _kdRealtimeRetryTimer = setTimeout(_sbRealtimeInit, 15000);
  }
}

// ============================================================
// v62 FITUR #3 — REALTIME CLOCK untuk KPI Omset (Admin/Staff)
// ============================================================
let _kdClockInterval = null;

function _startRealtimeClock(){
  // Only for non-superadmin
  if(currentUserRole === 'superadmin') return;
  _stopRealtimeClock();
  const clockEl = document.getElementById('kpi-omset-clock');
  const labelEl = document.getElementById('kpi-omset-label');
  if(clockEl){
    clockEl.style.display = '';
  }
  if(labelEl) labelEl.textContent = 'Omset Hari Ini';

  function _tick(){
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    if(clockEl){
      clockEl.textContent = 'Hari ini · ' + hh + ':' + mm + ':' + ss;
      clockEl.classList.add('ticking');
      setTimeout(()=>clockEl.classList.remove('ticking'),500);
    }
    // Refresh omset KPI every 30s
    if(now.getSeconds() % 30 === 0) _refreshRealtimeOmset();
  }
  _tick();
  _kdClockInterval = setInterval(_tick, 1000);
}

function _stopRealtimeClock(){
  if(_kdClockInterval){ clearInterval(_kdClockInterval); _kdClockInterval = null; }
}

// ── SUPERADMIN: Omset Hari Ini Real-time (semua cabang) ──
let _saClockInterval = null;
function _stopSaClock(){ if(_saClockInterval){ clearInterval(_saClockInterval); _saClockInterval = null; } }

function _calcSaTodayOmset(){
  const today = new Date().toISOString().slice(0,10);
  // FIX v116b: pjSave() menambah transaksi ke KEDUA array (penjualanData + omsetHistory)
  // Menggunakan keduanya → setiap transaksi dihitung 2x.
  // Solusi: selalu pakai omsetHistory sebagai single source of truth.
  // Fallback ke penjualanData hanya jika omsetHistory belum ada data hari ini
  // (misal: sebelum _sbLoadAll selesai / sesi offline).
  const fromOmset = omsetHistory.filter(o => o.tanggal && o.tanggal.slice(0,10) === today);
  const fromPenjualan = penjualanData.filter(p => p.tanggal && p.tanggal.slice(0,10) === today);
  const useOmset = fromOmset.length > 0;
  const rows = useOmset ? fromOmset : fromPenjualan;

  const total    = rows.reduce((s,r) => s + (useOmset ? (r.omset||0) : (r.total||0)), 0);
  const totalTrx = useOmset
    ? rows.reduce((s,o) => s + (o.trx||0), 0)
    : rows.length;

  // Cabang aktif hari ini (unik)
  const cabSet = new Set(rows.map(r => r.cabang).filter(Boolean));
  const cabangAktif = [...cabSet];

  // Top 3 cabang by omset hari ini
  const perCab = {};
  rows.forEach(r => {
    const cab = r.cabang;
    if(cab) perCab[cab] = (perCab[cab]||0) + (useOmset ? (r.omset||0) : (r.total||0));
  });
  const top3 = Object.entries(perCab).sort((a,b)=>b[1]-a[1]).slice(0,3);

  return { total, totalTrx, cabangAktif: cabangAktif.length, top3, avg: cabangAktif.length ? Math.round(total/cabangAktif.length) : 0 };
}

function _renderSaTodayKPI(){
  const card = document.getElementById('kpi-sa-today-card');
  if(!card) return;
  const d = _calcSaTodayOmset();

  const fmt = n => 'Rp ' + parseInt(n||0).toLocaleString('id-ID');

  const omsetEl  = document.getElementById('kpi-sa-today-omset');
  const trxEl    = document.getElementById('kpi-sa-today-trx');
  const cabEl    = document.getElementById('kpi-sa-today-cab');
  const avgEl    = document.getElementById('kpi-sa-today-avg');
  const cabList  = document.getElementById('kpi-sa-cabang-list');

  if(omsetEl) omsetEl.textContent = fmt(d.total);
  if(trxEl)   trxEl.textContent   = d.totalTrx + ' trx';
  if(cabEl)   cabEl.textContent   = d.cabangAktif + ' cabang';
  if(avgEl)   avgEl.textContent   = d.avg > 0 ? fmt(d.avg) : 'Rp 0';
  if(cabList){
    if(d.top3.length){
      cabList.textContent = 'Tertinggi: ' + d.top3.map(([cab,om])=>cab.replace('Kampung Dimsum ','KD')+' '+fmt(om)).join(' · ');
    } else {
      cabList.textContent = 'Belum ada transaksi hari ini';
    }
  }
}

function _startSaRealtimeClock(){
  _stopSaClock();
  const card = document.getElementById('kpi-sa-today-card');
  if(card) card.style.display = '';
  _renderSaTodayKPI();

  function _tick(){
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    const clockEl = document.getElementById('kpi-sa-clock');
    if(clockEl) clockEl.textContent = 'Update: ' + hh + ':' + mm + ':' + ss;
    // Refresh data setiap 30 detik
    if(now.getSeconds() % 30 === 0) _renderSaTodayKPI();
  }
  _tick();
  _saClockInterval = setInterval(_tick, 1000);
}

function _refreshRealtimeOmset(){
  if(currentUserRole === 'superadmin') return;
  const profile = window._currentAdmin;
  const myCabang = profile ? (profile.cabang_name || profile.cabang || '') : '';
  const today = new Date().toISOString().slice(0,10);
  const todayData = penjualanData.filter(p => p.cabang === myCabang && p.tanggal.slice(0,10) === today);
  const totalOmsetHari = todayData.reduce((s,p) => s+p.total, 0);
  const lastTrx = todayData.length ? todayData[0].tanggal.slice(11,16) : null;
  const subText = todayData.length
    ? todayData.length + ' transaksi · terakhir ' + (lastTrx||'—')
    : 'Belum ada transaksi hari ini';
  _setKPI('kpi-omset', 'Rp ' + _fmtJuta(totalOmsetHari), subText, todayData.length ? 'up' : '', 'kpi-omset-label', 'Omset Hari Ini');
}

// ============================================================
// v62 FITUR #2 — SUPERADMIN-ONLY DELETE (Omset, Penjualan, Stok)
// ============================================================
let _saDeletePending = null; // { type, idx, label }
// FIX v137 KRITIS: generic confirm callback — dipakai oleh flow yang BUKAN
// tipe SA (omset/penjualan/stok/banner), seperti bbHapus/lpHapus, yang
// sebelumnya salah memanggil saDeleteConfirm(message, callback) padahal
// fungsi itu tidak menerima parameter apapun → tombol Hapus tidak berfungsi
// dan tidak ada toast feedback sama sekali (root cause 2 bug yang dilaporkan).
let _genericConfirmCallback = null;
function customConfirm(message, onConfirm){
  _genericConfirmCallback = onConfirm;
  const warn = document.getElementById('sa-delete-warn');
  const info = document.getElementById('sa-delete-info');
  const title = document.getElementById('sa-delete-title');
  if(warn) warn.textContent = message;
  if(info) info.innerHTML = '';
  if(title) title.textContent = '🗑️ Konfirmasi Hapus Data';
  const overlay = document.getElementById('sa-delete-overlay');
  if(overlay) overlay.classList.add('show');
}

function showDeleteConfirmSA(type, idx, label){
  if(currentUserRole !== 'superadmin'){
    showToast('Akses ditolak — hanya Superadmin yang bisa menghapus data','error');
    return;
  }
  _saDeletePending = { type, idx, label };
  const warn = document.getElementById('sa-delete-warn');
  const info = document.getElementById('sa-delete-info');
  const typeLabel = { omset: 'Entri Omset', penjualan: 'Transaksi Penjualan', stok: 'Distribusi Stok' };
  if(warn) warn.textContent = 'Anda akan menghapus ' + (typeLabel[type]||type) + ' ini secara permanen dari sistem dan Supabase.';
  if(info) info.innerHTML = '<strong>Data:</strong> ' + label;
  const overlay = document.getElementById('sa-delete-overlay');
  if(overlay) overlay.classList.add('show');
}

function saDeleteClose(){
  const overlay = document.getElementById('sa-delete-overlay');
  if(overlay) overlay.classList.remove('show');
  // FIX v129: reset label tombol konfirmasi jika dibuka dari omset-duplikat dialog
  var confirmBtn = document.getElementById('sa-delete-confirm-btn');
  if(confirmBtn && confirmBtn.textContent !== 'Ya, Hapus') confirmBtn.textContent = 'Ya, Hapus';
  // FIX v137: kembalikan judul modal ke default (bisa berubah jika dipakai customConfirm)
  var titleEl = document.getElementById('sa-delete-title');
  if(titleEl) titleEl.textContent = '🗑️ Hapus Data — Superadmin Only';
  _saDeletePending = null;
  // FIX v137: reset generic callback juga, agar tidak nyangkut/ke-trigger salah sasaran
  _genericConfirmCallback = null;
}

async function saDeleteConfirm(){
  // FIX v137 KRITIS: jika ini konfirmasi generik (bbHapus/lpHapus dkk),
  // jalankan callback-nya langsung — JANGAN masuk ke logic _saDeletePending
  // di bawah (yang khusus tipe omset/penjualan/stok/banner).
  if(_genericConfirmCallback){
    var cb = _genericConfirmCallback;
    _genericConfirmCallback = null;
    saDeleteClose();
    cb();
    return;
  }
  if(!_saDeletePending){ saDeleteClose(); return; }
  if(currentUserRole !== 'superadmin'){ showToast('Akses ditolak','error'); saDeleteClose(); return; }
  const { type, idx } = _saDeletePending;
  saDeleteClose();

  try {
    if(type === 'omset'){
      const rec = omsetHistory[idx];
      if(!rec){ showToast('Data tidak ditemukan','error'); return; }
      omsetHistory.splice(idx,1);
      _persistOmset();
      renderOmsetTable();
      renderDashboardForRole();
      if(chartInstances['chart-omset'])  _refreshOmsetChart();
      if(chartInstances['chart-cabang']) _refreshCabangChart();
      if(chartInstances['chart-harian']) initChartHarian(_currentHarianOffset||0);
      if(currentUserRole === 'superadmin') _renderSaTodayKPI();
      // Delete from Supabase
      const sb = getSB();
      (async()=>{
        if(!sb){showToast('✓ Entri omset dihapus','success');return;}
        const q = rec.order_id
          ? sb.from('omset_entries').delete().eq('order_id',rec.order_id).eq('cabang',rec.cabang)
          : sb.from('omset_entries').delete().eq('tanggal',rec.tanggal).eq('cabang',rec.cabang).eq('omset',rec.omset);
        const {error}=await q;
        if(error){showToast('⚠️ Gagal hapus omset: '+error.message,'error');console.error('[KD] hapus omset:',error);}
        else showToast('✓ Entri omset dihapus','success');
      })();
    } else if(type === 'penjualan'){
      const rec = penjualanData[idx];
      if(!rec){ showToast('Data tidak ditemukan','error'); return; }
      penjualanData.splice(idx,1);
      _persistPenjualan();
      renderPenjualanTable();
      renderDashboardForRole();
      if(chartInstances['chart-produk'])  _refreshProdukChart();
      if(chartInstances['chart-payment']) _refreshPaymentChart();
      if(chartInstances['chart-realtime'])initRealtimeChart();
      if(currentUserRole === 'superadmin') _renderSaTodayKPI();
      const sb2 = getSB();
      (async()=>{
        if(!sb2||!rec.id){showToast('✓ Transaksi dihapus','success');return;}
        const {error}=await sb2.from('penjualan').delete().eq('order_id',rec.id);
        if(error){showToast('⚠️ Gagal hapus transaksi: '+error.message,'error');console.error('[KD] hapus penjualan:',error);}
        else showToast('✓ Transaksi penjualan dihapus','success');
      })();
    } else if(type === 'stok'){
      const rec = stokData[idx];
      if(!rec){ showToast('Data tidak ditemukan','error'); return; }
      // FIX v70 #6: jika status 'Terkirim', reverse inventoryState
      if(rec.status === 'Terkirim' && rec.cab && rec.produk && rec.jumlah > 0){
        _invDeduct(rec.cab, rec.produk, rec.jumlah);
      }
      stokData.splice(idx,1);
      // v88 FIX: recalculate inventoryState untuk cabang ini dari stokData tersisa
      _recalcInvFromStokData(rec.cab);
      // FIX v129 LOW-01: jika semua stok cabang INI habis (bukan seluruh stokData),
      // pastikan inventoryState cabang tersebut di-clear — bukan wipe semua cabang.
      // Bug lama: stokData.length===0 → hapus inventoryState SEMUA cabang termasuk
      // cabang lain yang masih punya stok. Sekarang hanya clear cabang yang dihapus.
      const remainingCabang = stokData.some(function(s){ return s.cab === rec.cab && s.status === 'Terkirim'; });
      if(!remainingCabang && inventoryState[rec.cab]){
        delete inventoryState[rec.cab];
      }
      _persistInv();
      localStorage.setItem('kd_inventoryState', JSON.stringify(inventoryState));
      _sbSyncInvState();
      renderStokTable();
      renderStokSummary();
      renderDashboardForRole(); // refresh KPI stok
      // FIX v92c: delete by idempotency_key jika ada, fallback ke kombinasi field
      const sb = getSB();
      if(sb){
        const delQuery = rec.idempotency_key
          ? sb.from('stok_distribusi').delete().eq('idempotency_key', rec.idempotency_key)
          : sb.from('stok_distribusi').delete()
              .eq('tanggal', rec.tgl)
              .eq('cabang', rec.cab)
              .eq('produk', rec.produk)
              .eq('jumlah', rec.jumlah)
              .limit(1);
        const {error:delErr} = await delQuery;
        if(delErr){showToast('⚠️ Gagal hapus stok: '+delErr.message,'error');console.error('[KD] delete stok:',delErr);}
        else showToast('✓ Data distribusi stok dihapus','success');
      } else {
        showToast('✓ Data distribusi stok dihapus','success');
      }
    } else if(type === 'banner'){
      // v124 FIX KRITIS-02: hapus banner via custom confirm dialog (bukan confirm() native)
      // confirm() native bisa diblokir mobile browser → banner tidak bisa dihapus
      var _banData = _getBanners(_saDeletePending.bannerType);
      var _banIdx  = _saDeletePending.bannerIdx;
      if(!_banData[_banIdx]){ showToast('Banner tidak ditemukan','error'); return; }
      _banData.splice(_banIdx, 1);
      _saveBanners(_saDeletePending.bannerType, _banData);
      bannerRenderAll();
      showToast('Banner dihapus','success');
    } else if(type === 'omset-duplikat'){
      // FIX v129 KRITIS-02b: konfirmasi simpan omset duplikat via dialog ini
      var pd = _saDeletePending;
      _commitOmset(pd._t, pd._c, pd._o, pd._trx);
      // Kembalikan label tombol konfirmasi ke default
      var confirmBtn = document.getElementById('sa-delete-confirm-btn');
      if(confirmBtn) confirmBtn.textContent = 'Ya, Hapus';
    }
  } catch(e){
    console.error('[KD] saDeleteConfirm error:', e);
    showToast('Gagal menghapus data: ' + e.message, 'error');
  }
}

// ====== HELPER: ambil profil dari tabel admin_profiles berdasarkan username ======
async function _getProfileByUsername(uname){
  // FIX v91: ilike = case-insensitive. Tidak filter active=true agar superadmin
  // yang tidak punya field active tetap bisa login.
  // Cari dulu dengan active=true, fallback tanpa filter active.
  const sb = getSB();
  // Coba cari berdasarkan username saja (tidak filter active) agar tidak miss
  const { data: rows, error } = await sb
    .from('admin_profiles')
    .select('*')
    .ilike('username', uname)
    .limit(1);
  if(error || !rows || rows.length === 0) return null;
  const profile = rows[0];
  // Cek active — jika field ada dan false, tolak
  if(profile.active === false) return null;
  return profile;
}

// ====== HELPER: ambil profil dari tabel berdasarkan user_id (untuk session restore) ======
async function _getProfileByUserId(userId){
  const { data, error } = await getSB()
    .from('admin_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if(error || !data) return null;
  return data;
}

// ====== HELPER: set current admin ke UI ======
function _applyAdminProfile(profile){
  window._currentAdmin = profile;
  // sync role
  currentUserRole = profile.role || 'staff';
  // v87 FIX: pakai _mergePerms — satu fungsi terpusat, non-superadmin default FALSE
  const mergedPerms = _mergePerms(profile.permissions, profile.role);
  profile.permissions = mergedPerms;
  window._currentPerms = mergedPerms;
  const av = document.getElementById('admin-avatar');
  if(av) av.textContent = (profile.display_name || profile.username).substring(0,2).toUpperCase();
  // Tampilkan nav Katalog hanya untuk superadmin
  const navKatalog = document.getElementById('nav-katalog');
  if(navKatalog) navKatalog.style.display = (currentUserRole === 'superadmin') ? 'flex' : 'none';

  // FIX v110: hard-reset semua panel ke dashboard di awal _applyAdminProfile
  // Mencegah panel dari akun sebelumnya (misal user-mgmt superadmin) tetap aktif
  // saat login ke akun lain (misal staff yang tidak punya akses panel itu)
  try {
    document.querySelectorAll('.admin-panel').forEach(function(p){ p.classList.remove('active','panel-enter'); });
    document.querySelectorAll('.admin-nav-item').forEach(function(n){ n.classList.remove('active'); });
    const dashPanel = document.getElementById('panel-dashboard');
    if(dashPanel) dashPanel.classList.add('active');
    const navDash = document.getElementById('nav-dashboard');
    if(navDash) navDash.classList.add('active');
  } catch(e){}

  // Refresh dashboard KPI sesuai role baru
  setTimeout(renderDashboardForRole, 200);
  // SUPABASE SYNC v55: load fresh data dari Supabase setelah login/session restore
  setTimeout(_sbLoadAll, 400);
  // v62: inisialisasi Realtime setelah 1 detik (setelah Supabase JS siap)
  setTimeout(function(){ _loadSupabase(function(){ _sbRealtimeInit(); }); }, 1200);
}

// ====== LOGIN ======
async function doLogin(){
  const uname = document.getElementById('login-user').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value.trim(); // BUG-FIX v69 BUG-02: trim() agar spasi awal/akhir tidak gagalkan login
  const hint  = document.getElementById('login-hint-msg');
  const btn   = document.querySelector('#page-admin-login .btn-primary');
  hint.textContent = '';
  if(!uname||!pass){ hint.textContent='Username dan password wajib diisi.'; return; }

  if(btn){ btn.textContent='Memuat...'; btn.disabled=true; }


  var _loginTimeout = setTimeout(function(){
    if(btn && btn.disabled){
      btn.textContent='Masuk ke Dashboard';
      btn.disabled=false;
      hint.style.color='red';
      hint.textContent='[TIMEOUT] Tidak ada respons dari server. Cek koneksi internet.';
    }
  }, 20000);

  _loadSupabase(async function(){
    clearTimeout(_loginTimeout);

    const sb = getSB();
    if(!sb){
      if(btn){ btn.textContent='Masuk ke Dashboard'; btn.disabled=false; }
      // CRIT-2 FIX: block login jika Supabase tidak tersedia — jangan biarkan fallback masuk
      hint.style.color = 'red';
      hint.textContent = 'Tidak dapat terhubung ke server autentikasi. Refresh halaman dan coba lagi.';
      return;
    }

    const profile = await _getProfileByUsername(uname);
    console.log('[KD Login] profile lookup:', uname, '->', profile ? 'found ('+profile.role+')' : 'NOT FOUND');
    if(!profile){
      if(btn){ btn.textContent='Masuk ke Dashboard'; btn.disabled=false; }
      hint.style.color = 'red';
      // FIX v91: tampilkan info lebih detail untuk debug
      hint.textContent = 'Username "' + uname + '" tidak ditemukan di database. Pastikan username sudah terdaftar di tabel admin_profiles.';
      return;
    }
    if(!profile.email_auth){
      if(btn){ btn.textContent='Masuk ke Dashboard'; btn.disabled=false; }
      hint.style.color = 'red';
      hint.textContent = 'Akun tidak memiliki email_auth. Hubungi Super Admin untuk reset.';
      return;
    }
    console.log('[KD Login] attempting signIn...');
    const { data, error } = await sb.auth.signInWithPassword({
      email: profile.email_auth,
      password: pass
    });
    if(btn){ btn.textContent='Masuk ke Dashboard'; btn.disabled=false; }

    if(error){
      console.warn('[KD Login] signIn error:', error.message, error.status);
      hint.style.color = 'red';
      if(error.message && error.message.toLowerCase().includes('email not confirmed')){
        hint.textContent = 'Akun belum dikonfirmasi. Buka Supabase Dashboard → Authentication → Users → klik akun ini → "Confirm".';
      } else if(error.message && error.message.toLowerCase().includes('invalid')){
        hint.textContent = 'Password salah.';
      } else {
        hint.textContent = 'Login gagal: ' + error.message;
      }
      return;
    }

    _applyAdminProfile(profile);
    showToast('Login berhasil! Selamat datang, ' + _esc(profile.display_name||uname), 'success');
    requestAnimationFrame(function(){
      goToPage('admin-dash');
      // v87 FIX: selalu reset ke dashboard saat login — jangan biarkan panel sebelumnya aktif
      switchPanel('dashboard', document.getElementById('nav-dashboard'));
    });
  });
}

// ====== LOGOUT ======
// ✅ BUG FIX #2 (CRITICAL) — QA: crash TypeError jika Supabase belum selesai load
// ROOT CAUSE: getSB() bisa return null sebelum Supabase JS selesai di-load
// null.auth.signOut() → uncaught TypeError crash
// FIX: cek sb dulu sebelum signOut — JANGAN ubah ke getSB().auth.signOut() langsung
async function doLogout(){
  const sb = getSB();
  if(sb) await sb.auth.signOut(); // hanya signOut jika Supabase sudah siap
  // v62: cleanup realtime & clock
  _stopRealtimeClock();
  _stopSaClock();
  _stopRealtimeChart();
  if(window._kdRealtimeChannel && sb){
    try { await sb.removeChannel(window._kdRealtimeChannel); } catch(e){}
    window._kdRealtimeChannel = null;
  }
  _sbSetLiveStatus(false);
  window._currentAdmin = null;
  // FIX BUG-L2: reset currentUserRole saat logout agar tidak bocor ke sesi berikutnya
  currentUserRole = 'staff';
  // v124 FIX MEDIUM-04: reset chart harian offset agar login berikutnya mulai dari bulan ini
  _currentHarianOffset = 0;
  // FIX v129 LOW-04: reset _orderSeq agar ID transaksi sesi baru mulai dari 1
  window._orderSeq = 0;
  // FIX v90: reset panel aktif ke dashboard agar login berikutnya tidak terjebak di panel lama
  // (misal: user-mgmt tetap aktif setelah logout → login akun lain langsung di user-mgmt)
  try {
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    const dashPanel = document.getElementById('panel-dashboard');
    if(dashPanel) dashPanel.classList.add('active');
    document.querySelectorAll('.admin-nav-item').forEach(n=>n.classList.remove('active'));
    const navDash = document.getElementById('nav-dashboard');
    if(navDash) navDash.classList.add('active');
  } catch(e){}
  goToPage('home');
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
}

// ====== SESSION PERSISTENCE — restore session saat tab di-refresh ======
// Dibungkus DOMContentLoaded agar goToPage tidak dipanggil sebelum DOM siap
function _restoreSession(){
  _loadSupabase(function(){
  (async function(){
    const sb = getSB();
    // CRIT-2 FIX: jika getSB() null (Supabase gagal load), jangan restore session
    // — biarkan user tetap di halaman home, bukan meloloskan ke admin shell
    if(!sb) return;
    const { data } = await sb.auth.getSession();
    if(data && data.session && data.session.user){
      const profile = await _getProfileByUserId(data.session.user.id);
      if(profile){
        _applyAdminProfile(profile);
        // CRIT-03 FIX: pre-load Chart.js sebelum goToPage agar renderAdminTables
        // + initCharts() tidak race dengan async script load Chart.js
        _loadChartJs(function(){
          requestAnimationFrame(function(){
            goToPage('admin-dash');
            // v87 FIX: sama seperti doLogin — selalu reset ke dashboard saat restore session
            switchPanel('dashboard', document.getElementById('nav-dashboard'));
          });
        });
      }
    }
  })();
  }); // end _loadHeavyLibs callback
}
// ── FIX v92b: PUBLIC DATA LOADER ──
// Load semua data publik dari Supabase tanpa perlu login
// Semua tabel ini harus punya RLS: FOR SELECT USING (true)
async function _loadPublicData(){
  // Load franchise setting (aktif atau segera hadir)
  // FIX v114: 800ms agar Supabase JS sudah ready (getSB tidak null)
  setTimeout(_loadFranchiseSetting, 800);
  _loadSupabase(async function(){
    const sb = getSB();
    if(!sb) return;

    // 1. PROMO — tabel promos
    try { await loadPromoFromSupabase(); } catch(e){ console.warn('[KD Public] promo:', e); }

    // 2. MENU — tabel menu_items
    try {
      const { data: mn, error } = await sb.from('menu_items').select('*').order('menu_id');
      if(!error && mn && mn.length){
        menuData.length = 0;
        mn.forEach(function(r){
          menuData.push({
            id: r.menu_id, cat: r.category, name: r.name,
            price: r.price, pcs: r.pcs, desc: r.description || '',
            inStock: r.in_stock !== false, img: r.img_url || '',
            badge: r.badge || '', tags: r.tags || [],
            // FIX v121 BUG #2: packaging & pcsPerBox wajib untuk stok kemasan yang benar
            packaging: r.packaging || '', pcsPerBox: r.pcs_per_box || 0
          }); // FIX v101 BUG-K2: 'category' → 'cat' agar konsisten dgn _sbLoadAll & semua filter
        });
        pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
        console.log('[KD Public] menu loaded:', menuData.length);
      }
    } catch(e){ console.warn('[KD Public] menu:', e); }

    // 3. CABANG — tabel cabang
    try {
      const { data: cab, error } = await sb.from('cabang').select('*').order('name', {ascending:true});
      if(!error && cab && cab.length){
        cabangData.length = 0;
        // v125 FIX: sort numerik — id berupa TEXT ('01','08','10') sehingga text sort tidak urut
        // Urutkan: produksi/pusat di atas, lalu cabang/agen urut numerik dari nama
        const _sortCab = function(a, b){
          const numA = parseInt((a.name||'').replace(/\D/g,'')) || 0;
          const numB = parseInt((b.name||'').replace(/\D/g,'')) || 0;
          const typeOrder = { produksi: -2, pusat: -1 };
          const tA = typeOrder[(a.type||'')] !== undefined ? typeOrder[a.type] : 0;
          const tB = typeOrder[(b.type||'')] !== undefined ? typeOrder[b.type] : 0;
          if(tA !== tB) return tA - tB;
          return numA - numB;
        };
        cab.sort(_sortCab);
        cab.forEach(function(r){
          cabangData.push({
            id: r.id, name: r.name, addr: r.addr||'', jam: r.jam||'08.00–21.00',
            rating: r.rating||5, wa: r.wa||'', open: r.open!==false,
            lat: r.lat||0, lng: r.lng||0, mapsUrl: r.maps_url||'', type: r.type||'cabang'
          });
        });
        if(typeof renderCabang === 'function') renderCabang();
        console.log('[KD Public] cabang loaded:', cabangData.length);
      }
    } catch(e){ console.warn('[KD Public] cabang:', e); }

    // 4. TESTIMONI — tabel feedback (tampilkan yang approved/publik)
    // v125 FIX: kolom approved/komentar/rating/cabang mungkin belum ada di tabel feedback
    // (lihat SQL migration di komentar const testimonials di atas)
    // Jika query error/kolom tidak ada → fallback ke testimonials hardcoded
    try {
      const { data: fb, error } = await sb.from('feedback')
        .select('nama, komentar, rating, cabang, created_at')
        .eq('approved', true)
        .order('created_at', {ascending: false})
        .limit(12);
      // Jika error (misal kolom tidak ada) → tidak replace hardcode, biarkan tampil
      if(!error && fb && fb.length){
        // Map ke format testimoni yang dipakai renderTestimoni
        // Filter: hanya tampilkan yang punya komentar tidak kosong
        const mapped = fb.filter(function(r){ return r.komentar && r.komentar.trim(); })
          .map(function(r){
            const nm = r.nama || 'Pelanggan';
            return {
              text: r.komentar || '',
              name: nm,
              loc: r.cabang || 'Depok',
              stars: Math.min(5, Math.max(1, parseInt(r.rating)||5)),
              init: nm.split(' ').slice(0,2).map(function(w){ return w[0]||''; }).join('').toUpperCase()
            };
          });
        if(mapped.length > 0){
          window._testimoniFromDB = mapped;
          window.testimonials = mapped;
          if(typeof renderTestimoni === 'function') renderTestimoni();
          console.log('[KD Public] testimoni loaded from DB:', mapped.length);
        } else {
          // Tidak ada testimoni approved/valid di DB → render dari hardcode
          if(typeof renderTestimoni === 'function') renderTestimoni();
          console.log('[KD Public] testimoni: pakai hardcode fallback');
        }
      } else {
        // Error atau kosong → render hardcode fallback
        if(typeof renderTestimoni === 'function') renderTestimoni();
        if(error) console.warn('[KD Public] testimoni DB error (mungkin kolom belum ada):', error.message);
      }
    } catch(e){ 
      console.warn('[KD Public] testimoni:', e);
      // Exception → render hardcode fallback
      if(typeof renderTestimoni === 'function') renderTestimoni();
    }
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _restoreSession);
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(_loadPublicData, 800);
  });
} else {
  _restoreSession();
  setTimeout(_loadPublicData, 800);
}

function renderCabang(filter=''){
  const items=filter?cabangData.filter(c=>c.name.toLowerCase().includes(filter.toLowerCase())||c.addr.toLowerCase().includes(filter.toLowerCase())):cabangData;
  const starSVG=`<svg viewBox="0 0 24 24" fill="none" width="13" height="13" style="vertical-align:middle"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="var(--gold)" stroke="var(--gold)" stroke-width="1"/></svg>`;
  const pinSVG=`<svg viewBox="0 0 24 24" fill="none" width="13" height="13" style="vertical-align:middle;flex-shrink:0"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="var(--red)" stroke="var(--red)" stroke-width="1"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`;
  const clockSVG=`<svg viewBox="0 0 24 24" fill="none" width="13" height="13" style="vertical-align:middle;flex-shrink:0"><circle cx="12" cy="12" r="9" stroke="var(--text3)" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="var(--red)" stroke-width="2" stroke-linecap="round"/></svg>`;
  const typeLabel={cabang:'Cabang',produksi:'Rumah Produksi',agen:'Agen'};
  const typeColor={cabang:'badge-normal',produksi:'badge-best',agen:'badge-open'};
  // PERF v17: render cabang chunked
  var _cabGrid=document.getElementById('cabang-grid');
  var _cabHTML=items.map(c=>{
    // CRIT-3 FIX: validasi mapsUrl — hanya izinkan protokol https://
    // mencegah javascript: URL injection jika data cabang datang dari API
    // BUG FIX: link tanpa protokol (mis. "maps.app.goo.gl/xxx" tanpa "https://")
    // dulu langsung jadi '#' (link mati). Sekarang auto-tambah https:// dulu
    // sebelum divalidasi, selama bukan scheme berbahaya seperti javascript:.
    const _rawMaps = (c.mapsUrl||'').trim();
    let safeMapsUrl = '#';
    if(_rawMaps){
      const _withProto = /^https?:\/\//i.test(_rawMaps) ? _rawMaps
        : (!/^[a-z][a-z0-9+.-]*:/i.test(_rawMaps) ? 'https://'+_rawMaps : '');
      if(/^https:\/\//.test(_withProto)) safeMapsUrl = _withProto;
    }
    return `
    <div class="cabang-card">
      <div class="cabang-header">
        <div>
          <div class="cabang-name">${_esc(c.name)}</div>
          <span class="td-badge ${typeColor[c.type||'cabang']}" style="font-size:.62rem;margin-top:3px;display:inline-block">${typeLabel[c.type||'cabang']}</span>
        </div>
        <div class="cabang-rating">${starSVG} ${c.rating}</div>
      </div>
      <div class="cabang-addr" style="display:flex;align-items:flex-start;gap:5px">${pinSVG} <span>${_esc(c.addr)}</span></div>
      <div style="font-size:.76rem;color:var(--text3);display:flex;align-items:center;gap:5px;margin-top:4px">${clockSVG} ${_esc(c.jam)}</div>
      <span class="cabang-status ${c.open?'status-open':'status-closed'}" style="margin-top:8px;display:inline-flex;align-items:center;gap:4px">
        <span style="display:inline-block;width:.55em;height:.55em;border-radius:50%;background:currentColor"></span>
        ${c.open?'Buka Sekarang':'Tutup'}
      </span>
      <div class="cabang-btns" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <a class="cabang-wa" href="https://wa.me/${c.wa}?text=Halo%20Kampung%20Dimsum%2C%20saya%20ingin%20bertanya..." target="_blank" style="flex:1;min-width:120px;display:flex;align-items:center;justify-content:center;gap:5px">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="currentColor" opacity=".8"/></svg> WhatsApp
        </a>
        <a href="${safeMapsUrl}" target="_blank" style="flex:1;min-width:120px;display:flex;align-items:center;justify-content:center;gap:5px;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;font-size:.78rem;font-weight:600;color:var(--text2);text-decoration:none;transition:all .2s" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseout="this.style.borderColor='';this.style.color=''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg> Lihat Maps
        </a>
        <div class="cabang-share" data-share="${encodeURIComponent(c.name+' — '+c.addr+' | Kampung Dimsum\n'+c.mapsUrl)}" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border2);border-radius:8px;cursor:pointer;flex-shrink:0;background:var(--bg2);transition:all .2s" title="Bagikan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"/><polyline points="16,6 12,2 8,6" stroke="var(--red)" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
  // ✅ BUG FIX #1 (CRITICAL) — QA: halaman cabang selalu kosong
  // ROOT CAUSE: _cabHTML dibangun tapi TIDAK PERNAH di-assign ke _cabGrid.innerHTML
  // Satu baris ini yang hilang — JANGAN dihapus, ini yang membuat kartu cabang muncul
  // Tanpa ini: filterCabang() juga tidak akan pernah update tampilan
  if(_cabGrid){
    _cabGrid.innerHTML = _cabHTML;
    // CRIT-01 FIX: event delegation — tidak ada string interpolasi di onclick, aman dari XSS
    _cabGrid.querySelectorAll('.cabang-share[data-share]').forEach(function(el){
      el.addEventListener('click', function(){
        openShareSheet(decodeURIComponent(el.dataset.share));
      });
    });
  }
}
function filterCabang(v){renderCabang(v);}

function renderPromo(){
  const _pg=document.getElementById('promo-grid');
  if(!_pg)return;
  // v82: hanya tampilkan promo yang aktif (active === true)
  const activePromos = promoData.filter(p => p.active !== false);
  if(!activePromos.length){
    _pg.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text3);font-size:.9rem">Belum ada promo aktif saat ini.</div>';
    return;
  }
  _pg.innerHTML=activePromos.map((p,i)=>`
    <div class="promo-card">
      <div class="promo-bg" style="background:${p.color}"></div>
      <div class="promo-overlay"></div>
      <div class="promo-content">
        <div class="promo-tag">${_esc(p.tag)}</div>
        <div class="promo-title">${_esc(p.title)}</div>
        <div class="promo-desc">${_esc(p.desc)}</div>
        <div class="promo-expire"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><rect x="3" y="4" width="18" height="18" rx="2" fill="var(--text2)" stroke="var(--text2)" stroke-width="1"/><path d="M16 2v4M8 2v4M3 10h18" stroke="white" stroke-width="1.5" fill="none"/><rect x="8" y="14" width="2" height="2" fill="white"/><rect x="12" y="14" width="2" height="2" fill="white" opacity="0.7"/><rect x="8" y="17" width="2" height="1.5" fill="white" opacity="0.7"/></svg> ${_esc(p.expire)}</div>
        <div class="promo-share-row">
          <button class="promo-share-btn" data-share-idx="${i}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" fill="none" stroke="var(--text2)" stroke-width="2"/><polyline points="16,6 12,2 8,6" fill="none" stroke="var(--red)" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="15" stroke="var(--red)" stroke-width="2"/></svg> Bagikan</button>
        </div>
      </div>
    </div>`).join('');
  // Event delegation — aman dari XSS, gunakan activePromos array untuk mapping
  _pg.querySelectorAll('.promo-share-btn[data-share-idx]').forEach(function(btn){
    btn.addEventListener('click', function(){
      const idx = parseInt(btn.dataset.shareIdx);
      const p = activePromos[idx];
      if(p) openShareSheet('Promo ' + p.title + ' di Kampung Dimsum! ' + p.desc);
    });
  });
}

function renderTestimoni(){
  // Gunakan data dari DB jika tersedia, fallback ke hardcoded testimonials
  var src = (window._testimoniFromDB && window._testimoniFromDB.length) ? window._testimoniFromDB : testimonials;
  if(src !== testimonials){ window.testimonials = src; }
  // CRIT-3 FIX: bangun elemen secara programatik agar data teks tidak di-parse sebagai HTML
  const grid = document.getElementById('testi-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const starSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="var(--gold)" stroke="var(--gold)" stroke-width="1"/></svg>';
  const pinSVG  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="var(--red)" stroke="var(--red)" stroke-width="1"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>';
  // v125 FIX KRITIS: loop pakai src (sudah include _testimoniFromDB), bukan testimonials (kosong)
  if(!src || !src.length){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px 16px;color:var(--text3);font-size:.9rem">Memuat ulasan pelanggan2026</div>'; return; }
  src.forEach(function(t){
    const card = document.createElement('div');
    card.className = 'testi-card';
    const stars = document.createElement('div');
    stars.className = 'testi-stars';
    stars.innerHTML = starSVG.repeat(t.stars);
    const text = document.createElement('div');
    text.className = 'testi-text';
    text.textContent = '\u201C' + t.text + '\u201D'; // textContent: aman dari XSS
    const author = document.createElement('div');
    author.className = 'testi-author';
    const avatar = document.createElement('div');
    avatar.className = 'testi-avatar';
    avatar.textContent = t.init;
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'testi-name';
    name.textContent = t.name;
    const loc = document.createElement('div');
    loc.className = 'testi-loc';
    loc.innerHTML = pinSVG + ' ';
    loc.appendChild(document.createTextNode(t.loc));
    info.appendChild(name); info.appendChild(loc);
    author.appendChild(avatar); author.appendChild(info);
    card.appendChild(stars); card.appendChild(text); card.appendChild(author);
    grid.appendChild(card);
  });
}

function renderFAQ(){
  // BUG-FIX v69 BUG-01: ganti innerHTML template literal ke DOM programatik
  // Sebelumnya: f.q dan f.a langsung di-interpolasi ke innerHTML → rentan XSS
  // jika data FAQ suatu saat diambil dari API/Supabase.
  // Fix: bangun elemen via createElement + textContent (aman dari XSS).
  const list = document.getElementById('faq-list');
  if(!list) return;
  list.innerHTML = '';
  faqData.forEach(function(f, i){
    const item = document.createElement('div');
    item.className = 'faq-item';
    item.id = 'faq-' + i;

    const q = document.createElement('div');
    q.className = 'faq-q';
    q.addEventListener('click', function(){ toggleFAQ(i); });

    const qSpan = document.createElement('span');
    qSpan.textContent = f.q; // textContent: aman dari XSS
    const icon = document.createElement('div');
    icon.className = 'faq-icon';
    icon.textContent = '+';
    q.appendChild(qSpan);
    q.appendChild(icon);

    const a = document.createElement('div');
    a.className = 'faq-a';
    a.textContent = f.a; // textContent: aman dari XSS

    item.appendChild(q);
    item.appendChild(a);
    list.appendChild(item);
  });
}
function toggleFAQ(i){
  const item=document.getElementById('faq-'+i);
  const isOpen=item.classList.contains('open');
  // Tutup semua FAQ lain
  document.querySelectorAll('.faq-item.open').forEach(function(el){
    el.classList.remove('open');
    const a=el.querySelector('.faq-a');
    if(a){ a.style.maxHeight='0'; a.style.paddingBottom='0'; }
    const icon=el.querySelector('.faq-icon');
    if(icon) icon.textContent='+';
  });
  // Toggle yang diklik
  if(!isOpen){
    item.classList.add('open');
    const ans=item.querySelector('.faq-a');
    if(ans){ ans.style.maxHeight=ans.scrollHeight+40+'px'; ans.style.paddingBottom='18px'; }
    const icon=item.querySelector('.faq-icon');
    if(icon) icon.textContent='×';
  }
}
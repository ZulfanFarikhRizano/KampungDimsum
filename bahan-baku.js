/* ===== BAHAN BAKU MODULE (v130) =====
   Input pembelian bahan baku per cabang.
   Setiap item: nama bebas (text), satuan (kg/liter/dll), qty (± button), harga per satuan.
   Riwayat disimpan di localStorage + Supabase tabel bahan_baku.

   SQL MIGRATION — jalankan di Supabase SQL Editor jika tabel belum ada:

   CREATE TABLE IF NOT EXISTS bahan_baku (
     id BIGSERIAL PRIMARY KEY,
     cabang TEXT NOT NULL,
     tanggal TEXT NOT NULL,
     items JSONB DEFAULT '[]',
     total NUMERIC DEFAULT 0,
     supplier TEXT DEFAULT '',
     catatan TEXT DEFAULT '',
     input_by TEXT DEFAULT '',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE bahan_baku ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "public_insert"    ON bahan_baku FOR INSERT WITH CHECK (true);
   CREATE POLICY "authenticated_all" ON bahan_baku FOR ALL USING (auth.role()='authenticated');
*/

/* ==================== CHANGELOG v134 ====================
  FITUR BARU — Filter Bulan & Hapus di Panel Bahan Baku + Laporan Produksi
  FIX — CSV Omset angka murni + PDF logo

  1. Filter bulan (input type="month") ditambahkan di:
     - Panel Bahan Baku → Riwayat Pembelian
     - Panel Laporan Produksi → Riwayat Produksi
     Filter bulan berlaku juga untuk Export CSV.

  2. Tombol "Hapus" di card Bahan Baku:
     - Muncul untuk superadmin dan user dengan akses bahan_baku
     - Pakai saDeleteConfirm (2-step confirm, aman)
     - Delete dari Supabase tabel bahan_baku + update _bbData + localStorage
     - Fungsi: bbHapus(id)

  3. Tombol "Hapus" di card Laporan Produksi:
     - Hanya untuk superadmin
     - Delete dari Supabase tabel produksi_bb + update _lpData
     - Fungsi: lpHapus(id)

  4. Empty state diupdate: tampilkan pesan "coba ubah filter" saat filter aktif.

  5. FIX CSV Omset: kolom "Omset" sekarang angka MURNI (tanpa titik/Rp)
     agar Excel/Sheets bisa SUM langsung. Ditambah kolom "Omset (Rp)" dan
     "Avg per Trx (Rp)" untuk keperluan baca manusia.

  6. FIX PDF Logo: logo.png di-fetch dan dikonversi ke base64 sebelum
     dimasukkan ke popup window, sehingga logo tampil saat print/save PDF.
     Fallback ke SVG dimsum icon jika fetch gagal.
     exportAnalitikCSV() dijadikan async untuk mendukung await fetch.
*/

/* ==================== CHANGELOG v131 ====================
  FITUR BARU — Modul Produksi Bahan Baku (Bahan → Dimsum)

  FITUR UTAMA:
  1. Tombol "✅ Tandai Selesai Produksi" di setiap card riwayat pembelian bahan baku.
     Hanya muncul jika record belum ditandai selesai (status !== 'selesai').
  2. Modal input produksi — admin bahan baku isi:
     - Tanggal selesai produksi
     - Hasil produksi: daftar produk dimsum + jumlah pcs yang dihasilkan
     - Catatan tambahan
  3. Data produksi disimpan ke tabel produksi_bb di Supabase + localStorage cache.
  4. Setelah selesai: badge "✅ Selesai Produksi" muncul di card, tombol disembunyikan.
  5. Panel "Laporan Produksi" baru (superadmin + pemilik akun bahan_baku):
     - KPI ringkasan: total pembelian, total selesai, total dimsum diproduksi
     - Riwayat produksi lengkap: dari bahan → hasil dimsum per record
  6. Permission: tombol tampil untuk user dengan akses bahan_baku; panel laporan
     laporan_produksi ditambahkan ke permLabels & allKeys.

  SQL MIGRATION — jalankan di Supabase SQL Editor:
  CREATE TABLE IF NOT EXISTS produksi_bb (
    id BIGSERIAL PRIMARY KEY,
    bahan_baku_id BIGINT REFERENCES bahan_baku(id) ON DELETE SET NULL,
    cabang TEXT NOT NULL,
    tanggal_beli TEXT NOT NULL,
    tanggal_selesai TEXT NOT NULL,
    hasil JSONB DEFAULT '[]',
    total_dimsum INT DEFAULT 0,
    catatan TEXT DEFAULT '',
    selesai_oleh TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE produksi_bb ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "public_insert" ON produksi_bb FOR INSERT WITH CHECK (true);
  CREATE POLICY "authenticated_all" ON produksi_bb FOR ALL USING (auth.role()='authenticated');

  -- Tambah kolom status ke bahan_baku (untuk track apakah sudah diproses)
  ALTER TABLE bahan_baku ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
  ALTER TABLE bahan_baku ADD COLUMN IF NOT EXISTS produksi_id BIGINT DEFAULT NULL;
*/

/* ==================== CHANGELOG v130 ====================
  BUG FIX #1 (CRITICAL) — pjSave: transaksi lolos meski stok = 0
    ROOT CAUSE: pjSave hanya memberi warning lalu tetap menyimpan transaksi
    meskipun stok item = 0 atau kurang dari kebutuhan.
    FIX: Pisahkan fase "cek stok" dan fase "deduct + simpan".
    Jika ada stok <= 0 atau available < needed → RETURN sebelum insert.
    Transaksi hanya dicatat jika SEMUA item lolos validasi stok.

  BUG FIX #2 (HIGH) — Bahan Baku: data tersimpan lokal, tidak sync Supabase
    ROOT CAUSE: tabel bahan_baku belum dibuat di Supabase sehingga
    setiap insert gagal → fallback localStorage dengan pesan error mentah.
    FIX: (a) SQL migration di komentar modul, copy-paste ke SQL Editor.
         (b) Banner peringatan otomatis muncul jika tabel belum ada,
             berisi SQL siap pakai + instruksi langkah demi langkah.
         (c) Error handling informatif: bedakan "tabel tidak ada" vs error lain.
         (d) Banner otomatis sembunyi setelah insert berhasil.

  BUG FIX #3 (LOW) — Bahan Baku form: field Harga/Sat (Rp) terpotong
    ROOT CAUSE: layout grid 2-kolom (Jumlah | Harga) terlalu sempit di mobile,
    label dan input terpotong, tidak bisa diketik dengan nyaman.
    FIX: Refactor layout per-item jadi 3 baris:
    - Baris 1: Nama Bahan (full width)
    - Baris 2: Jumlah | Satuan (50/50)
    - Baris 3: Harga per Satuan (full width, text-align center)
    Label diperbarui: "Harga/Sat (Rp)" → "Harga per Satuan (Rp)".
*/

var _bbData = [];   // riwayat lokal
var _bbItems = [];  // item dalam form aktif [ {nama, satuan, qty, harga} ]

// Satuan tersedia
var BB_SATUAN = ['kg','gram','liter','ml','botol','kaleng','karung','lusin','kodi','pcs','pack','ikat','buah','lembar','porsi','lainnya'];

// FIX v139: dulu warna badge cabang di-hardcode untuk 4 nama spesifik
// ('Pusat','Rumah Produksi','Cabang 1','Cabang 2') — cabang/rumah produksi
// baru yang ditambahkan otomatis jadi abu-abu generik dan susah dibedakan.
// Sekarang pakai hash deterministik dari nama, jadi tiap cabang baru otomatis
// punya warna konsisten tanpa perlu diedit manual setiap kali nambah cabang.
var BB_PALETTE = ['#2563eb','#16a34a','#d97706','#9333ea','#dc2626','#0891b2','#65a30d','#c026d3','#0d9488','#b91c1c'];
function _bbCabangColor(name){
  var str = name || '';
  var hash = 0;
  for(var i=0;i<str.length;i++){ hash = (hash*31 + str.charCodeAt(i)) % BB_PALETTE.length; }
  return BB_PALETTE[Math.abs(hash) % BB_PALETTE.length];
}

function bbTambahRumahProduksi(){
  // Hanya superadmin yang bisa tambah Rumah Produksi
  if(currentUserRole !== 'superadmin'){
    showToast('⚠️ Hanya superadmin yang dapat menambah Rumah Produksi','warn');
    return;
  }
  // Tutup modal bahan baku dulu, lalu buka panel cabang dengan tipe produksi pre-selected
  document.getElementById('modal-bahan-baku') && (document.getElementById('modal-bahan-baku').style.display = 'none');
  // Navigasi ke halaman manajemen cabang
  showPage('cabang');
  // Setelah halaman render, scroll ke form tambah & set type = produksi
  setTimeout(function(){
    var cbType = document.getElementById('cb-type');
    if(cbType){
      cbType.value = 'produksi';
      // Scroll to form
      var formEl = cbType.closest('.card') || cbType;
      formEl.scrollIntoView({behavior:'smooth', block:'center'});
      // Highlight form sebentar
      formEl.style.transition = 'box-shadow .3s';
      formEl.style.boxShadow = '0 0 0 3px rgba(234,122,40,.4)';
      setTimeout(function(){ formEl.style.boxShadow = ''; }, 1800);
    }
    showToast('📍 Isi form di bawah untuk tambah Rumah Produksi baru','info');
  }, 400);
}

function bbInit(){
  // Isi dropdown Rumah Produksi (hanya type === 'produksi')
  var sel = document.getElementById('bb-cabang');
  var selF = document.getElementById('bb-filter-cabang');
  if(sel){
    sel.innerHTML = '';
    // Semua user bisa pilih dari daftar Rumah Produksi yang ada
    var rpList = cabangData.filter(function(c){ return c.type === 'produksi'; });
    if(rpList.length === 0){
      var o = document.createElement('option');
      o.value = ''; o.textContent = '— Belum ada Rumah Produksi —';
      sel.appendChild(o);
    } else {
      rpList.forEach(function(c){
        var o = document.createElement('option');
        o.value = c.name; o.textContent = c.name;
        sel.appendChild(o);
      });
    }
    // Non-superadmin: jika punya cabang sendiri yg produksi, lock ke sana
    if(currentUserRole !== 'superadmin'){
      var myCabang = (window._currentAdmin && (window._currentAdmin.cabang_name || window._currentAdmin.cabang)) || '';
      var myRP = rpList.find(function(c){ return c.name === myCabang; });
      if(myRP){
        sel.value = myRP.name;
        sel.disabled = true;
      }
    }
  }
  if(selF){
    selF.innerHTML = '<option value="">Semua Rumah Produksi</option>';
    cabangData.filter(function(c){ return c.type === 'produksi'; }).forEach(function(c){
      var o = document.createElement('option');
      o.value = c.name; o.textContent = c.name;
      selF.appendChild(o);
    });
  }
  // Set tanggal hari ini
  var tgl = document.getElementById('bb-tanggal');
  if(tgl && !tgl.value) tgl.value = new Date().toISOString().slice(0,10);
  // Init items: 1 baris kosong
  if(_bbItems.length === 0) _bbItems = [bbNewItem()];
  bbRenderItems();
  // Load data
  bbLoadData();
}

function bbNewItem(){
  return { nama:'', satuan:'kg', qty:1, harga:0 };
}

function bbAddItem(){
  _bbItems.push(bbNewItem());
  bbRenderItems();
}

function bbRemoveItem(idx){
  if(_bbItems.length <= 1){ showToast('Minimal satu bahan harus ada','error'); return; }
  _bbItems.splice(idx,1);
  bbRenderItems();
}

function bbItemQtyChange(idx, delta){
  // FIX v139: dulu fungsi ini selalu panggil bbRenderItems() (full re-render),
  // yang bikin SEMUA input lain di form ikut remount → kalau user sedang
  // mengetik di field "Nama Bahan" item lain saat menekan +/-, fokus & cursor
  // posisinya hilang. Sekarang update langsung ke DOM elemen terkait saja.
  var it = _bbItems[idx];
  if(!it) return;
  it.qty = Math.max(0.01, (it.qty||0) + delta);
  var input = document.getElementById('bb-qty-'+idx);
  if(input) input.value = it.qty;
  bbUpdateItemSubtotal(idx);
}

function bbRenderItems(){
  var wrap = document.getElementById('bb-items-wrap');
  if(!wrap) return;
  wrap.innerHTML = _bbItems.map(function(item, i){
    var satuanOpts = BB_SATUAN.map(function(s){
      return '<option value="'+s+'"'+(item.satuan===s?' selected':'')+'>'+s+'</option>';
    }).join('');
    var hargaFmt = item.harga > 0 ? item.harga.toLocaleString('id-ID') : '';
    var subtotal  = (item.qty||0) * (item.harga||0);
    var subtotalFmt = subtotal > 0 ? 'Rp '+subtotal.toLocaleString('id-ID') : '—';

    // Warna badge nomor bahan
    var badgeColors = ['#EA7A28','#16a34a','#2563eb','#9333ea','#dc2626'];
    var bc = badgeColors[i % badgeColors.length];
    // Validasi ringan: tandai item belum lengkap (nama kosong atau qty tidak valid)
    var isIncomplete = !item.nama || !item.nama.trim() || !(item.qty > 0);

    return (
      '<div style="background:var(--bg2);border:1.5px solid var(--border2);border-radius:14px;overflow:hidden">'

        // ── item header ──
        + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg);border-bottom:1px solid var(--border)">'
          + '<div style="display:flex;align-items:center;gap:8px">'
            + '<span style="width:22px;height:22px;border-radius:7px;background:'+bc+';color:#fff;font-size:.68rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+(i+1)+'</span>'
            + '<span style="font-size:.78rem;font-weight:700;color:var(--text2)">Bahan '+(i+1)+'</span>'
            + '<span id="bb-incomplete-'+i+'" style="font-size:.62rem;font-weight:700;color:#dc2626;background:rgba(220,38,38,.08);padding:2px 7px;border-radius:20px;'+(isIncomplete?'':'display:none')+'">belum lengkap</span>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:6px">'
            + '<span id="bb-subtotal-'+i+'" style="font-size:.75rem;font-weight:700;color:'+bc+'">'+subtotalFmt+'</span>'
            + (_bbItems.length > 1
              ? '<button onclick="bbRemoveItem('+i+')" title="Hapus" style="width:26px;height:26px;border:none;background:rgba(220,38,38,.08);border-radius:7px;cursor:pointer;color:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
                  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>'
                + '</button>'
              : '')
          + '</div>'
        + '</div>'

        // ── nama bahan ──
        + '<div style="padding:10px 12px 0">'
          + '<label style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Nama Bahan</label>'
          + '<input type="text" value="'+_esc(item.nama)+'" oninput="_bbItems['+i+'].nama=this.value;bbUpdateItemIncomplete('+i+')" placeholder="Contoh: Tepung terigu, ayam, dll." '
            + 'style="width:100%;padding:11px 13px;border:1.5px solid var(--border2);border-radius:11px;background:var(--bg);color:var(--text);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">'
        + '</div>'

        // ── jumlah + satuan ── (layout: row di desktop, wrap ke 2 baris di mobile sempit)
        + '<div style="padding:8px 12px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:end">'
          + '<div style="flex:2;min-width:140px">'
            + '<label style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Jumlah</label>'
            + '<div style="display:flex;align-items:center;gap:6px;border:1.5px solid var(--border2);border-radius:11px;background:var(--bg);overflow:hidden;height:44px;padding:4px;box-sizing:border-box">'
              + '<button onclick="bbItemQtyChange('+i+',-1)" style="width:36px;height:36px;border:none;border-radius:8px;background:var(--bg2);font-size:1.1rem;font-weight:700;cursor:pointer;color:var(--text2);flex-shrink:0;display:flex;align-items:center;justify-content:center">−</button>'
              + '<input id="bb-qty-'+i+'" type="number" min="0.01" step="0.01" value="'+item.qty+'" oninput="_bbItems['+i+'].qty=Math.max(0,parseFloat(this.value)||0);bbUpdateItemSubtotal('+i+')" '
                + 'style="flex:1;min-width:0;text-align:center;border:none;background:none;font-size:.95rem;font-weight:800;color:var(--red);padding:0;outline:none;font-family:inherit">'
              + '<button onclick="bbItemQtyChange('+i+',1)" style="width:36px;height:36px;border:none;border-radius:8px;background:rgba(220,38,38,.12);font-size:1.1rem;font-weight:700;cursor:pointer;color:var(--red);flex-shrink:0;display:flex;align-items:center;justify-content:center">+</button>'
            + '</div>'
          + '</div>'
          + '<div style="flex:1;min-width:110px">'
            + '<label style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Satuan</label>'
            + '<div style="position:relative">'
            + '<select onchange="_bbItems['+i+'].satuan=this.value" style="width:100%;height:44px;padding:0 28px 0 10px;border:1.5px solid var(--border2);border-radius:11px;background:var(--bg);color:var(--text);font-size:.82rem;font-family:inherit;outline:none;box-sizing:border-box;appearance:none;-webkit-appearance:none">'+satuanOpts+'</select>'
            + '<svg style="position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2.5" width="11" height="11"><polyline points="6,9 12,15 18,9"/></svg>'
          + '</div>'
          + '</div>'
        + '</div>'

        // ── harga per satuan ──
        + '<div style="padding:8px 12px 12px">'
          + '<label style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px">Harga per Satuan <span style="color:var(--text4);font-weight:400">(Rp)</span></label>'
          + '<div style="display:flex;align-items:center;border:1.5px solid var(--border2);border-radius:11px;background:var(--bg);overflow:hidden">'
            + '<span style="padding:0 12px;font-size:.8rem;color:var(--text3);font-weight:600;white-space:nowrap;border-right:1px solid var(--border)">Rp</span>'
            + '<input type="text" inputmode="numeric" value="'+hargaFmt+'" placeholder="0" '
              + 'oninput="_bbItems['+i+'].harga=parseInt(this.value.replace(/[^0-9]/g,\'\'))||0;bbUpdateItemSubtotal('+i+')" '
              + 'style="flex:1;min-width:0;padding:11px 13px;border:none;background:none;color:var(--text);font-size:.92rem;font-weight:700;font-family:inherit;outline:none;text-align:right">'
          + '</div>'
        + '</div>'

      + '</div>'
    );
  }).join('');
}

function bbUpdateItemSubtotal(idx){
  // FIX v139 (BUG UTAMA): dulu fungsi ini (bbRenderItemSubtotal) cuma alias
  // kosong yang panggil bbAutoTotal() — badge subtotal di header tiap kartu
  // bahan TIDAK PERNAH ikut update saat qty/harga diketik manual, jadi angka
  // yang terlihat per-item nyasar/basi sampai ada add/remove item (full
  // re-render). Sekarang badge subtotal di-update langsung lewat DOM.
  var it = _bbItems[idx];
  if(!it) return;
  var sub = (it.qty||0) * (it.harga||0);
  var el = document.getElementById('bb-subtotal-'+idx);
  if(el) el.textContent = sub > 0 ? 'Rp '+sub.toLocaleString('id-ID') : '—';
  bbUpdateItemIncomplete(idx);
  bbAutoTotal();
}

function bbUpdateItemIncomplete(idx){
  // Tandai/lepas badge "belum lengkap" tanpa re-render seluruh form.
  var it = _bbItems[idx];
  if(!it) return;
  var badge = document.getElementById('bb-incomplete-'+idx);
  if(!badge) return;
  var incomplete = !it.nama || !it.nama.trim() || !(it.qty > 0);
  badge.style.display = incomplete ? '' : 'none';
}

function bbAutoTotal(){
  var total = _bbItems.reduce(function(s, it){ return s + (it.qty||0)*(it.harga||0); }, 0);
  var el = document.getElementById('bb-total');
  if(el) el.value = total > 0 ? total.toLocaleString('id-ID') : '';
}

function bbFormatTotal(input){
  var raw = parseInt(input.value.replace(/[^0-9]/g,''))||0;
  input.value = raw > 0 ? raw.toLocaleString('id-ID') : '';
}

function bbSave(){
  var cabang = (document.getElementById('bb-cabang')||{}).value || '';
  var tanggal = (document.getElementById('bb-tanggal')||{}).value || '';
  var supplier = ((document.getElementById('bb-supplier')||{}).value||'').trim();
  var catatan = ((document.getElementById('bb-catatan')||{}).value||'').trim();

  if(!cabang){ showToast('Pilih Rumah Produksi terlebih dahulu','error'); return; }
  if(!tanggal){ showToast('Pilih tanggal','error'); return; }

  // Definisikan validItems DULU baru hitung total
  var validItems = _bbItems.filter(function(it){ return it.nama && it.nama.trim() && it.qty > 0; });
  if(!validItems.length){ showToast('Minimal satu bahan dengan nama dan jumlah valid','error'); return; }

  // FIX v139: dulu item yang sudah diisi nama tapi qty-nya 0/negatif/kosong
  // langsung hilang diam-diam dari validItems tanpa pemberitahuan apapun ke
  // user — datanya seakan "ditelan". Sekarang beri peringatan eksplisit.
  var skipped = _bbItems.filter(function(it){ return it.nama && it.nama.trim() && !(it.qty > 0); });
  if(skipped.length){
    showToast('⚠️ '+skipped.length+' bahan dilewati karena jumlahnya belum diisi/tidak valid: '+skipped.map(function(it){return it.nama.trim();}).join(', '), 'warning');
  }

  // Hitung total langsung dari items (akurat, tidak dari field yang bisa stale)
  var totalRaw = validItems.reduce(function(s,it){ return s + (it.qty||0)*(it.harga||0); }, 0);
  var record = {
    id: Date.now(),
    cabang: cabang,
    tanggal: tanggal,
    items: validItems.map(function(it){ return {nama: it.nama.trim(), satuan: it.satuan, qty: it.qty, harga: it.harga||0}; }),
    total: totalRaw,
    supplier: supplier,
    catatan: catatan,
    created_at: new Date().toISOString(),
    inputBy: (window._currentAdmin && window._currentAdmin.username) || ''
  };

  // Simpan ke Supabase jika tersedia
  var sb = getSB ? getSB() : null;
  if(sb){
    sb.from('bahan_baku').insert([{
      cabang: record.cabang,
      tanggal: record.tanggal,
      items: JSON.stringify(record.items),
      total: record.total,
      supplier: record.supplier,
      catatan: record.catatan,
      input_by: record.inputBy
    }]).then(function(res){
      if(res.error){
        var isMissingTable = res.error.message && res.error.message.indexOf('bahan_baku') !== -1;
        if(isMissingTable){
          // Tabel belum dibuat di Supabase — tampilkan pesan khusus dengan instruksi
          _bbData.unshift(record);
          _bbSaveLocal();
          showToast(
            '⚠️ Tabel bahan_baku belum ada di Supabase!\n'
            +'Data disimpan sementara di lokal.\n'
            +'Jalankan SQL migration di komentar kode (BAHAN BAKU MODULE) untuk mengaktifkan sinkronisasi.',
            'warning'
          );
          // Tampilkan banner instruksi di halaman
          var banner = document.getElementById('bb-migration-banner');
          if(banner) banner.style.display = 'block';
        } else {
          _bbData.unshift(record);
          _bbSaveLocal();
          showToast('Tersimpan lokal (Supabase error: '+res.error.message+')','warning');
        }
      } else {
        if(res.data && res.data[0]) record.id = res.data[0].id;
        _bbData.unshift(record);
        _bbSaveLocal();
        var banner = document.getElementById('bb-migration-banner');
        if(banner) banner.style.display = 'none'; // sembunyikan banner jika sukses
        showToast('✅ Pembelian bahan baku berhasil disimpan ke database','success');
      }
      bbRenderTable();
    });
  } else {
    _bbData.unshift(record);
    _bbSaveLocal();
    showToast('Pembelian bahan baku berhasil disimpan (lokal)','success');
    bbRenderTable();
  }
  bbReset();
}

function bbReset(){
  _bbItems = [bbNewItem()];
  bbRenderItems();
  var el;
  if((el=document.getElementById('bb-total'))) el.value='';
  if((el=document.getElementById('bb-supplier'))) el.value='';
  if((el=document.getElementById('bb-catatan'))) el.value='';
  var tgl = document.getElementById('bb-tanggal');
  if(tgl) tgl.value = new Date().toISOString().slice(0,10);
}

function bbLoadData(){
  // Muat dari Supabase jika ada
  var sb = getSB ? getSB() : null;
  if(sb){
    sb.from('bahan_baku').select('*').order('tanggal',{ascending:false}).then(function(res){
      if(!res.error && res.data){
        _bbData = res.data.map(function(r){
          var items = [];
          try{ items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items||[]); }catch(e){}
          return { id:r.id, cabang:r.cabang, tanggal:r.tanggal, items:items, total:r.total||0, supplier:r.supplier||'', catatan:r.catatan||'', created_at:r.created_at, inputBy:r.input_by||'', status:r.status||'pending', produksi_id:r.produksi_id||null };
        });
        _bbSaveLocal();
        // Tabel ada & berhasil — sembunyikan migration banner
        var banner = document.getElementById('bb-migration-banner');
        if(banner) banner.style.display = 'none';
      } else {
        bbLoadLocal();
        // Cek apakah error karena tabel belum ada
        if(res.error && res.error.message && res.error.message.indexOf('bahan_baku') !== -1){
          var banner = document.getElementById('bb-migration-banner');
          if(banner) banner.style.display = 'block';
        }
      }
      bbRenderTable();
    });
  } else {
    bbLoadLocal();
    bbRenderTable();
  }
}

function bbLoadLocal(){
  try{ var d = localStorage.getItem('bb_data'); if(d) _bbData = JSON.parse(d); }catch(e){}
}
function _bbSaveLocal(){
  try{ localStorage.setItem('bb_data', JSON.stringify(_bbData.slice(0,500))); }catch(e){}
}

function bbRenderTable(){
  var list = document.getElementById('bb-riwayat-list');
  if(!list) return;

  var selF = document.getElementById('bb-filter-cabang');
  if(selF){
    var curVal = selF.value;
    var cabangSet = {};
    _bbData.forEach(function(r){ if(r.cabang) cabangSet[r.cabang] = 1; });
    selF.innerHTML = '<option value="">Semua Cabang</option>'
      + Object.keys(cabangSet).map(function(c){
          return '<option value="'+_esc(c)+'"'+(curVal===c?' selected':'')+'>'+_esc(c)+'</option>';
        }).join('');
  }

  var filterCabang = selF ? selF.value : '';
  var filterBulan = (document.getElementById('bb-filter-bulan')||{}).value || '';
  var rows = _bbData.filter(function(r){
    if(filterCabang && r.cabang !== filterCabang) return false;
    if(filterBulan){
      var tgl = r.tanggal || r.created_at || '';
      if(!tgl.startsWith(filterBulan)) return false;
    }
    return true;
  });

  if(!rows.length){
    list.innerHTML = '<div style="text-align:center;padding:32px 16px">'
      + '<div style="font-size:2rem;margin-bottom:8px">📭</div>'
      + '<div style="font-size:.85rem;color:var(--text3);font-weight:500">Belum ada data pembelian</div>'
      + '<div style="font-size:.75rem;color:var(--text4);margin-top:4px">'+(filterBulan||filterCabang?'Coba ubah filter bulan atau cabang':'Data akan muncul setelah pembelian disimpan')+'</div>'
      + '</div>';
    return;
  }

  list.innerHTML = rows.map(function(r){
    var tglFormatted = (function(){
      try{ return new Date(r.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
      catch(e){ return r.tanggal || '—'; }
    })();
    var cColor = _bbCabangColor(r.cabang);
    var status = r.status || 'pending';
    var isSelesai = status === 'selesai';
    var canAct = (currentUserRole === 'superadmin') || ((window._currentPerms||{}).bahan_baku);

    // Item bahan baku — compact chips
    var itemChips = (r.items||[]).map(function(it){
      var sub = (it.qty||0)*(it.harga||0);
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--border)">'
        + '<div style="min-width:0;flex:1">'
          + '<span style="font-size:.83rem;font-weight:700;color:var(--text)">'+_esc(it.nama||'—')+'</span>'
          + '<span style="font-size:.72rem;color:var(--text3);margin-left:6px;font-weight:500">'+it.qty+' '+_esc(it.satuan||'')+'</span>'
          + (it.harga>0 ? '<div style="font-size:.68rem;color:var(--text4);margin-top:1px">@ Rp '+it.harga.toLocaleString('id-ID')+'</div>' : '')
        + '</div>'
        + (sub>0 ? '<span style="font-size:.78rem;font-weight:700;color:var(--text2);white-space:nowrap;margin-left:8px">Rp '+sub.toLocaleString('id-ID')+'</span>' : '')
      + '</div>';
    }).join('');

    return '<div style="background:var(--bg);border:1.5px solid '+(isSelesai?'#bbf7d0':' var(--border2)')+';border-radius:16px;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.05)">'
      // ── header strip ──
      + '<div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:'+(isSelesai?'rgba(22,163,74,.06)':'var(--bg2)')+';border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;align-items:center;gap:7px;min-width:0">'
          + '<span style="width:9px;height:9px;border-radius:50%;background:'+cColor+';flex-shrink:0;display:inline-block"></span>'
          + '<div style="min-width:0">'
            + '<div style="font-size:.72rem;font-weight:700;color:'+cColor+';text-transform:uppercase;letter-spacing:.04em;line-height:1.2">'+_esc(r.cabang||'—')+'</div>'
            + '<div style="font-size:.68rem;color:var(--text3)">'+tglFormatted+'</div>'
          + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
          + (isSelesai ? '<span style="padding:3px 8px;background:#f0fdf4;border:1px solid #86efac;border-radius:20px;font-size:.62rem;font-weight:700;color:#16a34a">✅ Selesai</span>' : '<span style="padding:3px 8px;background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.4);border-radius:20px;font-size:.62rem;font-weight:700;color:#b45309">⏳ Proses</span>')
          + '<div style="text-align:right">'
            + '<div style="font-size:.6rem;color:var(--text3)">Total</div>'
            + '<div style="font-size:.9rem;font-weight:800;color:var(--red)">Rp '+(r.total||0).toLocaleString('id-ID')+'</div>'
          + '</div>'
        + '</div>'
      + '</div>'
      // ── items list ──
      + '<div style="padding:8px 14px 4px">'
        + (itemChips || '<div style="padding:4px 0;font-size:.75rem;color:var(--text4)">Tidak ada item</div>')
      + '</div>'
      // ── meta footer (supplier/catatan/inputBy) ──
      + ((r.supplier||r.catatan||r.inputBy) ? (
        '<div style="padding:6px 14px 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
          + (r.supplier ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:var(--text3);background:var(--bg2);padding:3px 7px;border-radius:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>'+_esc(r.supplier)+'</span>' : '')
          + (r.catatan ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:var(--text3);background:var(--bg2);padding:3px 7px;border-radius:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'+_esc(r.catatan)+'</span>' : '')
          + (r.inputBy ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:var(--text4);margin-left:auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+_esc(r.inputBy)+'</span>' : '')
        + '</div>'
      ) : '<div style="height:6px"></div>')
      // ── action buttons ──
      + (canAct ? (
        '<div style="padding:0 14px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px">'
          + '<button data-bbid="'+r.id+'" onclick="bbHapus(this.dataset.bbid)" style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:transparent;color:#ef4444;border:1.5px solid #fca5a5;border-radius:9px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>'
            + 'Hapus</button>'
          + (isSelesai
              ? '<span style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:9px;font-size:.72rem;font-weight:700;color:#16a34a">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                + 'Selesai Produksi</span>'
              : '<button data-bbid="'+r.id+'" onclick="bbTandaiProduksi(this.dataset.bbid)" style="display:inline-flex;align-items:center;gap:5px;padding:7px 13px;background:#16a34a;color:#fff;border:none;border-radius:9px;font-size:.75rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(22,163,74,.28);font-family:inherit">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                + 'Tandai Selesai</button>'
            )
        + '</div>'
      ) : '')
    + '</div>';
  }).join('');
}

function bbExportCSV(){
  if(!_bbData.length){ showToast('Tidak ada data untuk diekspor','error'); return; }
  var filterCabang = (document.getElementById('bb-filter-cabang')||{}).value || '';
  var filterBulan  = (document.getElementById('bb-filter-bulan')||{}).value  || '';
  var rows = _bbData.filter(function(r){
    if(filterCabang && r.cabang !== filterCabang) return false;
    if(filterBulan){ var tgl=r.tanggal||r.created_at||''; if(!tgl.startsWith(filterBulan)) return false; }
    return true;
  });
  var lines = [['Tanggal','Cabang','Nama Bahan','Satuan','Jumlah','Harga/Satuan','Subtotal','Total Pembelian','Supplier','Catatan','Input Oleh'].join(',')];
  rows.forEach(function(r){
    (r.items||[]).forEach(function(it,i){
      lines.push([
        r.tanggal, r.cabang,
        '"'+(it.nama||'').replace(/"/g,'""')+'"',
        it.satuan, it.qty, (it.harga||0).toLocaleString('id-ID'), ((it.qty*(it.harga||0)).toLocaleString('id-ID')),
        i===0 ? (r.total||0).toLocaleString('id-ID') : '',
        '"'+(r.supplier||'').replace(/"/g,'""')+'"',
        '"'+(r.catatan||'').replace(/"/g,'""')+'"',
        '"'+(r.inputBy||'').replace(/"/g,'""')+'"'
      ].join(','));
    });
  });
  var csv = '\uFEFF' + lines.join('\r\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'bahan_baku_'+(filterCabang||'semua')+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

/* ============================================================
   MODUL PRODUKSI BAHAN BAKU — v131
   Alur: Pembelian Bahan Baku → Proses Produksi → Hasil Dimsum
   ============================================================ */

var _lpData = [];          // cache riwayat produksi
var _bbProdItems = [];     // item hasil produksi di modal (nama produk + qty pcs)
var _bbProdCurrentId = null; // id record bahan_baku yang sedang diproses

// Produk dimsum default sebagai opsi (bebas ketik juga)
var BB_PRODUK_DIMSUM = [
  'Dimsum Original','Dimsum Keju','Dimsum Topping 6 Pcs','Dimsum Topping 8 Pcs',
  'Dimsum Topping 10 Pcs','Dimsum Topping 16 Pcs','Dimsum Topping 25 Pcs',
  'Snackbox 4 Pcs','Dimsum Goreng','Birthday Pack','Lainnya'
];

/* ─── Buka modal produksi dari card riwayat ─── */
function bbTandaiProduksi(bbId){
  var rec = _bbData.find(function(r){ return String(r.id) === String(bbId); });
  if(!rec){
    var sb = getSB ? getSB() : null;
    if(sb){
      sb.from('bahan_baku').select('*').eq('id', bbId).single().then(function(res){
        if(res.error || !res.data){ showToast('Data tidak ditemukan','error'); return; }
        var r = res.data;
        var items = [];
        try{ items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items||[]); }catch(e){}
        var fetched = { id:r.id, cabang:r.cabang, tanggal:r.tanggal, items:items, total:r.total||0, supplier:r.supplier||'', catatan:r.catatan||'', created_at:r.created_at, inputBy:r.input_by||'', status:r.status||'pending', produksi_id:r.produksi_id||null };
        _bbData.push(fetched);
        bbTandaiProduksiOpen(fetched);
      });
    } else { showToast('Data tidak ditemukan','error'); }
    return;
  }
  bbTandaiProduksiOpen(rec);
}

function bbTandaiProduksiOpen(rec){
  var bbId = rec.id;
  _bbProdCurrentId = bbId;
  _bbProdItems = [{ nama: 'Dimsum Original', qty: 1 }];

  // Subtitle
  var el = document.getElementById('bb-prod-subtitle');
  if(el) el.textContent = rec.cabang + ' · ' + (function(){
    try{ return new Date(rec.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
    catch(e){ return rec.tanggal; }
  })();

  // Info bahan baku
  var infoEl = document.getElementById('bb-prod-info');
  if(infoEl){
    var itemsStr = (rec.items||[]).map(function(it){
      return it.nama + ' ' + it.qty + ' ' + it.satuan;
    }).join(' · ');
    infoEl.innerHTML = '<span style="font-weight:700;color:var(--text)">Bahan yang dibeli:</span> '
      + (itemsStr || '—')
      + '<br><span style="font-weight:700;color:var(--text)">Supplier:</span> ' + (rec.supplier||'—')
      + (rec.total ? ' <span style="font-weight:700;color:var(--red)"> · Total: Rp ' + rec.total.toLocaleString('id-ID') + '</span>' : '');
  }

  // Set tanggal hari ini
  var tglEl = document.getElementById('bb-prod-tanggal');
  if(tglEl) tglEl.value = new Date().toISOString().slice(0,10);

  // Reset catatan
  var catEl = document.getElementById('bb-prod-catatan');
  if(catEl) catEl.value = '';

  bbProdRenderItems();

  var ov = document.getElementById('bb-produksi-overlay');
  if(ov){ ov.style.display='flex'; ov.classList.add('show'); document.body.classList.add('modal-nav-hidden'); }
}

function bbProduksiClose(){
  var ov = document.getElementById('bb-produksi-overlay');
  if(ov){ ov.classList.remove('show'); setTimeout(function(){ ov.style.display='none'; }, 280); document.body.classList.remove('modal-nav-hidden'); }
  _bbProdCurrentId = null;
  _bbProdItems = [];
}

/* ─── Tambah/hapus item hasil produksi ─── */
function bbProdAddItem(){
  _bbProdItems.push({ nama: 'Dimsum Original', qty: 1 });
  bbProdRenderItems();
}
function bbProdRemoveItem(idx){
  if(_bbProdItems.length <= 1){ showToast('Minimal satu produk','error'); return; }
  _bbProdItems.splice(idx,1);
  bbProdRenderItems();
}

function bbProdRenderItems(){
  var wrap = document.getElementById('bb-prod-items-wrap');
  if(!wrap) return;

  wrap.innerHTML = _bbProdItems.map(function(item, i){
    var selectedOpts = BB_PRODUK_DIMSUM.map(function(p){
      return '<option value="'+p+'"'+(item.nama===p?' selected':'')+'>'+p+'</option>';
    }).join('');
    return (
      '<div style="background:var(--bg2);border:1.5px solid var(--border2);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px">'
        + '<select oninput="_bbProdItems['+i+'].nama=this.value" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--border2);border-radius:9px;background:var(--bg);color:var(--text);font-size:.85rem;font-weight:600;font-family:inherit;outline:none;appearance:none;-webkit-appearance:none">'
          + selectedOpts
        + '</select>'
        + '<div style="display:flex;align-items:center;gap:8px">'
          + '<div style="display:flex;align-items:center;gap:6px;border:1.5px solid var(--border2);border-radius:9px;background:var(--bg);overflow:hidden;height:44px;padding:4px;flex:1;box-sizing:border-box">'
            + '<button onclick="var n=parseInt(document.getElementById(\'bb-pq-'+i+'\').value||0);n=Math.max(0,n-1);document.getElementById(\'bb-pq-'+i+'\').value=n;_bbProdItems['+i+'].qty=n;bbProdUpdateTotal()" style="width:36px;height:36px;border:none;border-radius:8px;background:var(--bg2);cursor:pointer;color:var(--text2);font-size:1.15rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">−</button>'
            + '<input id="bb-pq-'+i+'" type="number" min="0" inputmode="numeric" value="'+item.qty+'" oninput="_bbProdItems['+i+'].qty=parseInt(this.value)||0;bbProdUpdateTotal()" style="flex:1;min-width:0;text-align:center;border:none;background:transparent;font-size:1rem;font-weight:800;color:var(--red,#dc2626);outline:none;font-family:inherit;padding:0;-moz-appearance:textfield;-webkit-appearance:none" />'
            + '<button onclick="var n=parseInt(document.getElementById(\'bb-pq-'+i+'\').value||0)+1;document.getElementById(\'bb-pq-'+i+'\').value=n;_bbProdItems['+i+'].qty=n;bbProdUpdateTotal()" style="width:36px;height:36px;border:none;border-radius:8px;background:rgba(220,38,38,.12);cursor:pointer;color:var(--red,#dc2626);font-size:1.15rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">+</button>'
          + '</div>'
          + '<span style="font-size:.82rem;color:var(--text3);font-weight:600;flex-shrink:0">pcs</span>'
        + '</div>'
        + (_bbProdItems.length > 1
          ? '<button onclick="bbProdRemoveItem('+i+')" style="width:100%;padding:6px;border:none;background:rgba(220,38,38,.06);border-radius:7px;cursor:pointer;color:#dc2626;font-size:.75rem;font-weight:600;font-family:inherit">Hapus</button>'
          : '')
      + '</div>'
    );
  }).join('');

  // Update total
  var total = _bbProdItems.reduce(function(s,it){ return s+(it.qty||0); }, 0);
  var totEl = document.getElementById('bb-prod-total-dimsum');
  if(totEl) totEl.textContent = total.toLocaleString('id-ID') + ' pcs';
}

/* ─── Update total dimsum tanpa re-render full ─── */
function bbProdUpdateTotal(){
  var total = _bbProdItems.reduce(function(s,it){ return s+(parseInt(it.qty)||0); }, 0);
  var totEl = document.getElementById('bb-prod-total-dimsum');
  if(totEl) totEl.textContent = total.toLocaleString('id-ID') + ' pcs';
}

/* ─── Simpan produksi ─── */
function bbProduksiSave(){
  var bbId = _bbProdCurrentId;
  var rec  = _bbData.find(function(r){ return String(r.id) === String(bbId); });
  if(!rec){ showToast('Data bahan baku tidak ditemukan','error'); return; }

  var tglSelesai = (document.getElementById('bb-prod-tanggal')||{}).value || '';
  if(!tglSelesai){ showToast('Pilih tanggal selesai produksi','error'); return; }

  // Sinkronkan qty dari DOM input sebelum validasi (antisipasi oninput tidak ter-fire)
  _bbProdItems.forEach(function(item, i){
    var inp = document.getElementById('bb-pq-'+i);
    if(inp) item.qty = parseInt(inp.value)||0;
  });

  var validHasil = _bbProdItems.filter(function(it){ return (it.nama||'').trim() && it.qty > 0; });
  if(!validHasil.length){ showToast('Isi minimal satu produk dengan jumlah > 0','error'); return; }

  var totalDimsum = validHasil.reduce(function(s,it){ return s+(parseInt(it.qty)||0); }, 0);
  var catatan = (document.getElementById('bb-prod-catatan')||{}).value || '';
  var selesaiOleh = (window._currentAdmin && (window._currentAdmin.display_name || window._currentAdmin.username)) || '';

  // Bahan baku yang diproses — ambil dari record pembelian
  var bahanDipakai = (rec.items || []).map(function(it){
    return { nama: it.nama||'', qty: it.qty||0, satuan: it.satuan||'' };
  });

  var prodRecord = {
    bahan_baku_id: rec.id,
    cabang: rec.cabang,
    tanggal_beli: rec.tanggal,
    tanggal_selesai: tglSelesai,
    hasil: validHasil,
    total_dimsum: totalDimsum,
    catatan: catatan,
    selesai_oleh: selesaiOleh,
    created_at: new Date().toISOString(),
    _bb_items: bahanDipakai
  };

  var sb = getSB ? getSB() : null;
  if(sb){
    var isLocalId = !prodRecord.bahan_baku_id || String(prodRecord.bahan_baku_id).length > 10;
    var safeBbId = isLocalId ? null : prodRecord.bahan_baku_id;
    sb.from('produksi_bb').insert([{
      bahan_baku_id: safeBbId,
      cabang: prodRecord.cabang,
      tanggal_beli: prodRecord.tanggal_beli,
      tanggal_selesai: prodRecord.tanggal_selesai,
      hasil: JSON.stringify(prodRecord.hasil),
      total_dimsum: prodRecord.total_dimsum,
      catatan: prodRecord.catatan,
      selesai_oleh: prodRecord.selesai_oleh,
      bahan_dipakai: JSON.stringify(bahanDipakai)
    }]).then(function(res){
      if(res.error){
        prodRecord.id = Date.now();
        _lpData.unshift(prodRecord);
        _lpSaveLocal();
        var errMsg = res.error.message || '';
        if(errMsg.indexOf('does not exist') !== -1){
          showToast('⚠️ Tabel produksi_bb belum ada — jalankan SQL migration','warning');
        } else {
          showToast('⚠️ Gagal simpan ke database: '+errMsg,'warning');
        }
      } else {
        _lpData.unshift(prodRecord);
        _lpSaveLocal();
        showToast('✅ Produksi berhasil dicatat!','success');
      }
      sb.from('bahan_baku').update({ status: 'selesai', produksi_id: prodRecord.id }).eq('id', rec.id).then(function(){});
      rec.status = 'selesai';
      rec.produksi_id = prodRecord.id;
      _bbSaveLocal();
      bbProduksiClose();
      bbRenderTable();
      lpRender();
    });
  } else {
    prodRecord.id = Date.now();
    _lpData.unshift(prodRecord);
    _lpSaveLocal();
    rec.status = 'selesai';
    rec.produksi_id = prodRecord.id;
    _bbSaveLocal();
    bbProduksiClose();
    bbRenderTable();
    lpRender();
    showToast('Produksi dicatat (lokal)','success');
  }
}

/* ─── Tombol Tandai Selesai Produksi sudah diintegrasikan langsung ke bbRenderTable di atas ─── */

/* ─── LAPORAN PRODUKSI — load & render ─── */
function lpInit(){
  _lpLoadData();
  // Sync filter cabang
  var sel = document.getElementById('lp-filter-cabang');
  if(sel){
    sel.innerHTML = '<option value="">Semua Cabang</option>';
    cabangData.filter(function(c){ return c.type === 'cabang'; }).forEach(function(c){
      var o = document.createElement('option');
      o.value = c.name; o.textContent = c.name;
      sel.appendChild(o);
    });
  }
}

function _lpLoadData(){
  var sb = getSB ? getSB() : null;
  if(sb){
    sb.from('produksi_bb').select('*').order('tanggal_selesai',{ascending:false}).then(function(res){
      if(!res.error && res.data){
        _lpData = res.data.map(function(r){
          var hasil = [];
          try{ hasil = typeof r.hasil === 'string' ? JSON.parse(r.hasil) : (r.hasil||[]); }catch(e){}
          var bbItems = [];
          try{ bbItems = typeof r.bahan_dipakai === 'string' ? JSON.parse(r.bahan_dipakai) : (r.bahan_dipakai||[]); }catch(e){}
          return {
            id: r.id, bahan_baku_id: r.bahan_baku_id,
            cabang: r.cabang, tanggal_beli: r.tanggal_beli,
            tanggal_selesai: r.tanggal_selesai,
            hasil: hasil, total_dimsum: r.total_dimsum||0,
            catatan: r.catatan||'', selesai_oleh: r.selesai_oleh||'',
            _bb_items: bbItems,
            created_at: r.created_at
          };
        });
        _lpSaveLocal();
        // Sync status ke _bbData — hanya jika _bbData sudah terisi
        // (jika panel laporan-produksi dibuka sebelum bahan-baku, load lokal dulu)
        if(_bbData.length === 0){ bbLoadLocal(); }
        _lpData.forEach(function(lp){
          var bb = _bbData.find(function(r){ return String(r.id) === String(lp.bahan_baku_id); });
          if(bb){ bb.status = 'selesai'; bb.produksi_id = lp.id; }
        });
        _bbSaveLocal();
      } else {
        _lpLoadLocal();
        var errMsg2 = (res.error && res.error.message) ? res.error.message : '';
        var isMissing = errMsg2.indexOf('produksi_bb') !== -1
          || errMsg2.indexOf('relation') !== -1
          || errMsg2.indexOf('does not exist') !== -1;
        if(isMissing){ _lpShowMigrationBanner(); }
      }
      lpRender();
    });
  } else {
    _lpLoadLocal();
    lpRender();
  }
}

/* ─── Banner migration produksi_bb ─── */
var _lpMigrationSQL = 'CREATE TABLE IF NOT EXISTS produksi_bb (\n'
  + '  id             BIGSERIAL PRIMARY KEY,\n'
  + '  bahan_baku_id  BIGINT,\n'
  + '  cabang         TEXT,\n'
  + '  tanggal_beli   DATE,\n'
  + '  tanggal_selesai DATE,\n'
  + '  hasil          JSONB,\n'
  + '  total_dimsum   INT DEFAULT 0,\n'
  + '  catatan        TEXT,\n'
  + '  selesai_oleh   TEXT,\n'
  + '  bahan_dipakai  JSONB DEFAULT \'[]\',\n'
  + '  created_at     TIMESTAMPTZ DEFAULT NOW()\n'
  + ');\n'
  + '-- Jika tabel sudah ada, tambah kolom bahan_dipakai:\n'
  + 'ALTER TABLE produksi_bb ADD COLUMN IF NOT EXISTS bahan_dipakai JSONB DEFAULT \'[]\';';

var _lpMigrationShown = false;
function _lpShowMigrationBanner(){
  if(_lpMigrationShown) return;
  _lpMigrationShown = true;
  var list = document.getElementById('lp-riwayat-list');
  if(!list || !list.parentNode) return;

  var banner = document.createElement('div');
  banner.id = 'lp-migration-banner';
  banner.style.cssText = 'background:rgba(234,179,8,.12);border:1.5px solid rgba(234,179,8,.5);border-radius:14px;padding:16px 18px;margin-bottom:16px;font-family:inherit';
  banner.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px">'
    + '<span style="font-size:1.25rem;line-height:1.4">⚠️</span>'
    + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:700;color:#92400e;font-size:.88rem;margin-bottom:4px">'
        + 'Tabel <code style="background:rgba(0,0,0,.08);padding:1px 6px;border-radius:4px">produksi_bb</code> belum ada di Supabase'
      + '</div>'
      + '<div style="font-size:.78rem;color:#78350f;margin-bottom:10px">'
        + 'Data produksi tersimpan lokal saja. Jalankan SQL berikut di <strong>Supabase → SQL Editor</strong>:'
      + '</div>'
      + '<div style="position:relative">'
        + '<pre style="background:#1e1b4b;color:#c7d2fe;font-size:.7rem;line-height:1.65;padding:12px 40px 12px 14px;border-radius:10px;overflow-x:auto;white-space:pre;margin:0;font-family:monospace">'
          + _lpMigrationSQL.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        + '</pre>'
        + '<button id="lp-copy-btn" onclick="_lpCopyMigrationSQL()" style="position:absolute;top:8px;right:8px;padding:3px 10px;border:none;border-radius:6px;background:rgba(255,255,255,.18);color:#c7d2fe;font-size:.68rem;font-weight:600;cursor:pointer;font-family:inherit">Copy</button>'
      + '</div>'
      + '<div style="margin-top:8px;font-size:.74rem;color:#78350f">Setelah migration dijalankan, refresh halaman agar data lokal tersinkronisasi.</div>'
      + '<button onclick="document.getElementById(\'lp-migration-banner\').style.display=\'none\'" style="margin-top:10px;padding:4px 14px;border:1px solid rgba(234,179,8,.5);border-radius:7px;background:transparent;color:#92400e;font-size:.74rem;font-weight:600;cursor:pointer;font-family:inherit">Tutup</button>'
    + '</div>'
  + '</div>';

  list.parentNode.insertBefore(banner, list);
}

function _lpCopyMigrationSQL(){
  if(navigator.clipboard){
    navigator.clipboard.writeText(_lpMigrationSQL).then(function(){
      var btn = document.getElementById('lp-copy-btn');
      if(btn){ btn.textContent = '✓ Copied!'; setTimeout(function(){ btn.textContent = 'Copy'; },2000); }
    });
  }
}

function _lpLoadLocal(){
  try{ var d = localStorage.getItem('lp_data'); if(d) _lpData = JSON.parse(d); }catch(e){}
}
function _lpSaveLocal(){
  try{ localStorage.setItem('lp_data', JSON.stringify(_lpData.slice(0,500))); }catch(e){}
}

function lpRender(){
  var list = document.getElementById('lp-riwayat-list');
  if(!list) return;

  // Update KPI
  var kpiBeli = document.getElementById('lp-kpi-beli');
  var kpiSelesai = document.getElementById('lp-kpi-selesai');
  var kpiDimsum = document.getElementById('lp-kpi-dimsum');
  if(kpiBeli) kpiBeli.textContent = _bbData.length;
  if(kpiSelesai) kpiSelesai.textContent = _lpData.length;
  var totalDimsum = _lpData.reduce(function(s,r){ return s+(r.total_dimsum||0); }, 0);
  if(kpiDimsum) kpiDimsum.textContent = totalDimsum.toLocaleString('id-ID');

  // Sync filter
  var selF = document.getElementById('lp-filter-cabang');
  var filterCabang = selF ? selF.value : '';
  var filterBulan = (document.getElementById('lp-filter-bulan')||{}).value || '';
  if(selF){
    var curVal = selF.value;
    var cabangSet = {};
    _lpData.forEach(function(r){ if(r.cabang) cabangSet[r.cabang] = 1; });
    selF.innerHTML = '<option value="">Semua Cabang</option>'
      + Object.keys(cabangSet).map(function(c){
          return '<option value="'+c+'"'+(curVal===c?' selected':'')+'>'+c+'</option>';
        }).join('');
  }
  filterCabang = selF ? selF.value : '';

  var rows = _lpData.filter(function(r){
    if(filterCabang && r.cabang !== filterCabang) return false;
    if(filterBulan){
      var tgl = r.tanggal_selesai || r.tanggal_beli || r.created_at || '';
      if(!tgl.startsWith(filterBulan)) return false;
    }
    return true;
  });

  if(!rows.length){
    list.innerHTML = '<div style="text-align:center;padding:40px 16px">'
      + '<div style="font-size:2.5rem;margin-bottom:10px">🥟</div>'
      + '<div style="font-size:.88rem;color:var(--text3);font-weight:600">Belum ada data produksi</div>'
      + '<div style="font-size:.75rem;color:var(--text4);margin-top:6px">'+(filterBulan||filterCabang?'Coba ubah filter bulan atau cabang':'Produksi akan muncul setelah admin bahan baku menandai pembelian selesai diproses')+'</div>'
      + '</div>';
    return;
  }

  list.innerHTML = rows.map(function(r){
    var tglBeli = (function(){
      try{ return new Date(r.tanggal_beli).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
      catch(e){ return r.tanggal_beli||'—'; }
    })();
    var tglSelesai = (function(){
      try{ return new Date(r.tanggal_selesai).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
      catch(e){ return r.tanggal_selesai||'—'; }
    })();
    var hasilHtml = (r.hasil||[]).map(function(h){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--border)">'
        + '<span style="font-size:.82rem;font-weight:600;color:var(--text)">'+_esc(h.nama||'—')+'</span>'
        + '<span style="font-size:.82rem;font-weight:700;color:#2563eb">'+((h.qty||0).toLocaleString('id-ID'))+' pcs</span>'
      + '</div>';
    }).join('');

    // Cari data bahan baku aslinya — dari _bbData atau _bb_items yang disimpan langsung
    var bbRec = _bbData.find(function(b){ return String(b.id) === String(r.bahan_baku_id); });
    var bbItems = bbRec ? (bbRec.items||[]) : (r._bb_items || r.bb_items || []);
    var bahanStr = bbItems.length
      ? bbItems.map(function(it){ return it.nama+' '+it.qty+(it.satuan||''); }).join(', ')
      : '—';

    return '<div style="background:var(--bg);border:1.5px solid var(--border2);border-radius:16px;overflow:hidden;margin-bottom:12px">'
      // header
      + '<div style="padding:12px 16px;background:linear-gradient(135deg,rgba(22,163,74,.08),rgba(22,163,74,.03));border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
        + '<div>'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:#16a34a;flex-shrink:0;display:inline-block"></span>'
            + '<span style="font-size:.72rem;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.05em">'+_esc(r.cabang||'—')+'</span>'
            + '<span style="padding:2px 7px;background:#f0fdf4;border:1px solid #86efac;border-radius:20px;font-size:.66rem;font-weight:700;color:#16a34a">✅ Selesai</span>'
          + '</div>'
          + '<div style="font-size:.72rem;color:var(--text3)">Beli: '+tglBeli+' → Selesai: '+tglSelesai+'</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0">'
          + '<div style="font-size:.66rem;color:var(--text3);margin-bottom:2px">Total Dimsum</div>'
          + '<div style="font-size:1.1rem;font-weight:800;color:#2563eb">'+((r.total_dimsum||0).toLocaleString('id-ID'))+' pcs</div>'
        + '</div>'
      + '</div>'
      // bahan baku asal
      + '<div style="padding:10px 16px;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:.65rem;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Bahan Baku yang Diproses</div>'
        + '<div style="font-size:.8rem;color:var(--text2)">'+_esc(bahanStr)+'</div>'
      + '</div>'
      // hasil produksi
      + '<div style="padding:10px 16px">'
        + '<div style="font-size:.65rem;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Hasil Produksi</div>'
        + hasilHtml
      + '</div>'
      // footer meta + hapus
      + '<div style="padding:8px 16px 12px;background:var(--bg2);border-top:1px solid var(--border);display:flex;flex-wrap:wrap;align-items:center;gap:8px">'
        + ((r.catatan||r.selesai_oleh) ? (
            (r.catatan ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.7rem;color:var(--text3)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'+_esc(r.catatan)+'</span>' : '')
            + (r.selesai_oleh ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:.7rem;color:var(--text4)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+_esc(r.selesai_oleh)+'</span>' : '')
          ) : '')
        + ((currentUserRole==='superadmin') ? (
            '<button data-lpid="'+r.id+'" onclick="lpHapus(this.dataset.lpid)" style="margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:6px 11px;background:transparent;color:#ef4444;border:1.5px solid #fca5a5;border-radius:9px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>'
            + 'Hapus</button>'
          ) : '')
      + '</div>'
    + '</div>';
  }).join('');
}

function lpExportCSV(){
  if(!_lpData.length){ showToast('Tidak ada data produksi untuk diekspor','error'); return; }
  var filterCabang = (document.getElementById('lp-filter-cabang')||{}).value || '';
  var filterBulan  = (document.getElementById('lp-filter-bulan')||{}).value  || '';
  var rows = _lpData.filter(function(r){
    if(filterCabang && r.cabang !== filterCabang) return false;
    if(filterBulan){ var tgl=r.tanggal_selesai||r.tanggal_beli||''; if(!tgl.startsWith(filterBulan)) return false; }
    return true;
  });
  var lines = [['Cabang','Tanggal Beli','Tanggal Selesai','Produk','Jumlah (pcs)','Total Dimsum','Catatan','Selesai Oleh'].join(',')];
  rows.forEach(function(r){
    (r.hasil||[]).forEach(function(h,i){
      lines.push([
        r.cabang, r.tanggal_beli, r.tanggal_selesai,
        '"'+(h.nama||'').replace(/"/g,'""')+'"',
        h.qty||0,
        i===0 ? (r.total_dimsum||0) : '',
        '"'+(r.catatan||'').replace(/"/g,'""')+'"',
        '"'+(r.selesai_oleh||'').replace(/"/g,'""')+'"'
      ].join(','));
    });
    if(!(r.hasil||[]).length){
      lines.push([r.cabang,r.tanggal_beli,r.tanggal_selesai,'—',0,r.total_dimsum||0,
        '"'+(r.catatan||'').replace(/"/g,'""')+'"',
        '"'+(r.selesai_oleh||'').replace(/"/g,'""')+'"'].join(','));
    }
  });
  var csv = '\uFEFF' + lines.join('\r\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'laporan_produksi_'+(filterCabang||'semua')+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

// ==================== v134: HAPUS BAHAN BAKU ====================
// FIX v137 KRITIS: sebelumnya panggil saDeleteConfirm(message, callback) — fungsi
// itu TIDAK menerima parameter, jadi modal tidak terbuka & callback hapus tidak
// pernah jalan (tombol Hapus seolah tidak berfungsi, tanpa toast feedback apapun).
// Sekarang pakai customConfirm() yang memang didesain generik untuk kasus ini.
function bbHapus(id){
  if(!id){ showToast('ID tidak valid','error'); return; }
  customConfirm('Hapus data pembelian bahan baku ini? Data yang sudah ditandai selesai produksi tetap tercatat di Laporan Produksi.', function(){
    var sb = getSB();
    if(sb){
      sb.from('bahan_baku').delete().eq('id', id).then(function(res){
        if(res.error){ showToast('Gagal hapus: '+res.error.message,'error'); return; }
        _bbData = _bbData.filter(function(r){ return String(r.id) !== String(id); });
        // FIX v139 (BUG KRITIS): sebelumnya disimpan ke key 'kd_bahan_baku_<cabang>'
        // sementara bbLoadLocal()/_bbSaveLocal() selalu membaca/menulis key 'bb_data'.
        // Akibatnya cache lokal TIDAK PERNAH ikut terhapus — kalau Supabase offline
        // saat reload, data yang sudah dihapus bisa muncul lagi. Sekarang pakai
        // helper yang sama dengan proses simpan agar key selalu konsisten.
        _bbSaveLocal();
        bbRenderTable();
        showToast('Data pembelian berhasil dihapus','success');
      });
    } else {
      // Offline: hapus dari localStorage saja
      _bbData = _bbData.filter(function(r){ return String(r.id) !== String(id); });
      _bbSaveLocal();
      bbRenderTable();
      showToast('Dihapus (offline)','success');
    }
  });
}

// ==================== v134: HAPUS LAPORAN PRODUKSI ====================
// FIX v137 KRITIS: sama seperti bbHapus — ganti ke customConfirm() yang benar.
function lpHapus(id){
  if(!id){ showToast('ID tidak valid','error'); return; }
  customConfirm('Hapus laporan produksi ini? Stok hasil produksi yang sudah tercatat tidak akan ikut terhapus.', function(){
    var sb = getSB();
    if(sb){
      sb.from('produksi_bb').delete().eq('id', id).then(function(res){
        if(res.error){ showToast('Gagal hapus: '+res.error.message,'error'); return; }
        _lpData = _lpData.filter(function(r){ return String(r.id) !== String(id); });
        // FIX v139: cache lokal sebelumnya tidak pernah diupdate setelah hapus
        // (selalu hilang dari tampilan tapi muncul lagi kalau Supabase offline).
        _lpSaveLocal();
        lpRender();
        showToast('Laporan produksi berhasil dihapus','success');
      });
    } else {
      _lpData = _lpData.filter(function(r){ return String(r.id) !== String(id); });
      _lpSaveLocal();
      lpRender();
      showToast('Dihapus (offline)','success');
    }
  });
}
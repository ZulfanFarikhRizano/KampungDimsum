// ============ CURRENCY / NUMBER FORMATTING ============
function formatWithDots(val){
  const num=val.replace(/\D/g,'');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function initCurrencyFields(){
  document.querySelectorAll('.currency-field,.number-field').forEach(input=>{
    input.addEventListener('input',function(){
      const pos=this.selectionStart;
      const prevLen=this.value.length;
      this.value=formatWithDots(this.value);
      const newLen=this.value.length;
      const newPos=pos+(newLen-prevLen);
      try{this.setSelectionRange(newPos,newPos);}catch(e){}
    });
    input.addEventListener('paste',function(e){
      e.preventDefault();
      const text=(e.clipboardData||window.clipboardData).getData('text');
      this.value=formatWithDots(text);
      this.dispatchEvent(new Event('input'));
    });
  });
}
function getRawNumber(id){
  return parseInt((document.getElementById(id).value||'0').replace(/\./g,''))||0;
}
function toggleAddMenu(){
  const f=document.getElementById('add-menu-form');
  const isOpen=f.style.display!=='none'&&f.style.display!=='';
  if(isOpen){f.style.display='none';return;}
  // Reset form for adding new
  document.getElementById('am-nama').value='';
  document.getElementById('am-harga').value='';
  document.getElementById('am-desc').value='';
  document.getElementById('am-kat').value='topping';
  const editIdx=document.getElementById('am-edit-idx');
  if(editIdx)editIdx.value='-1';
  const fh=f.querySelector('h3');if(fh)fh.textContent='Tambah Item Menu Baru';
  f.style.display='block';
}
function saveMenu(){
  const nama=document.getElementById('am-nama').value.trim();
  const hargaRaw=document.getElementById('am-harga').value.replace(/\./g,'').replace(/[^0-9]/g,'');
  const harga=parseInt(hargaRaw)||0;
  const desc=document.getElementById('am-desc').value.trim();
  const kat=document.getElementById('am-kat').value;
  const editIdxEl=document.getElementById('am-edit-idx');
  const editIdx=editIdxEl?parseInt(editIdxEl.value):-1;
  if(!nama||!harga){showToast('Nama dan harga wajib diisi!','error');return;}
  if(harga > 10000000){showToast('Harga menu tidak boleh melebihi Rp 10.000.000!','error');return;} // BUG-FIX v69 BUG-04
  if(editIdx>=0){
    menuData[editIdx].name=nama;
    menuData[editIdx].price=harga;
    menuData[editIdx].desc=desc;
    menuData[editIdx].cat=kat;
    // BUG FIX v56: sync ke Supabase menu_items (sama seperti katalogSaveItem)
    _katalogSyncToSupabase(menuData[editIdx]);
    showToast('Menu berhasil diupdate','success');
  } else {
    const newId = menuData.length > 0 ? Math.max(...menuData.map(m=>m.id||0)) + 1 : 1;
    // FIX v121 TC-23: auto-derive packaging saat tambah menu via saveMenu (panel menu-mgmt)
    const _smPkgKey = _menuCatToInvKey(kat, nama);
    const _smPcsPerBox = (function(n){ const m=n.match(/(\d+)\s*[Pp]cs/); return m?parseInt(m[1]):1; })(nama);
    const newItem = {id:newId,name:nama,desc:desc,price:harga,cat:kat,img:'',badge:'',tags:[],inStock:true, packaging:_smPkgKey||'', pcsPerBox:_smPcsPerBox};
    menuData.push(newItem);
    // BUG FIX v56: sync ke Supabase menu_items
    _katalogSyncToSupabase(newItem, true);
    // BUG-L2 FIX: warn jika nama tidak mengandung angka pcs — stok deduction akan fallback ke 1 pcs/box
    if(!/\d+\s*[Pp]cs/.test(nama)){
      showToast('Nama menu tidak mengandung jumlah pcs (misal "4 Pcs"). Stok akan dipotong 1 pcs/box.','info');
    } else {
      showToast('Menu baru berhasil ditambahkan','success');
    }
  }
  renderAdminTables();
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  // FIX v70 #5: sync page-menu publik dan katalog storefront
  if(typeof pmRender==='function') pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  if(typeof renderKatalogGrid==='function') renderKatalogGrid(window._katalogCurrentFilter||'all');
  // FIX v119 #2: sync ke halaman Penjualan
  if(typeof pjRenderMenuGrid==='function') pjRenderMenuGrid();
  document.getElementById('add-menu-form').style.display='none';
}

function editMenu(idx){
  const m=menuData[idx];
  const f=document.getElementById('add-menu-form');
  document.getElementById('am-nama').value=m.name;
  // ✅ BUG FIX #4 (MEDIUM) — format harga dengan titik ribuan agar konsisten dengan type="text" currency-field
  document.getElementById('am-harga').value=m.price.toLocaleString('id-ID');
  document.getElementById('am-desc').value=m.desc||'';
  document.getElementById('am-kat').value=m.cat||'topping';
  const editIdxEl=document.getElementById('am-edit-idx');
  if(editIdxEl)editIdxEl.value=idx;
  const fh=f.querySelector('h3');if(fh)fh.textContent='Edit Item: '+m.name;
  f.style.display='block';
  f.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function hapusMenu(idx){
  // BUG FIX v59: gunakan menu_id sebagai anchor, bukan positional idx
  // Root cause: idx berdasarkan posisi array, bisa berubah kalau _sbLoadAll() reload data
  // di antara klik pertama dan klik konfirmasi — akibatnya item yang terhapus salah/semua
  const item = menuData[idx];
  if(!item){ showToast('Item tidak ditemukan, refresh halaman','error'); return; }
  const stableId = item.id; // pakai id stabil (menu_id) bukan posisi
  const name = item.name;
  if(!window._menuDelConfirm || window._menuDelPendingId !== stableId){
    window._menuDelConfirm = true;
    window._menuDelPendingId = stableId;
    showToast('Klik "Hapus" lagi untuk konfirmasi hapus '+name,'error');
    setTimeout(()=>{ window._menuDelConfirm=false; window._menuDelPendingId=null; }, 3500);
    return;
  }
  window._menuDelConfirm = false;
  window._menuDelPendingId = null;
  // Cari ulang index berdasarkan id (bukan pakai idx lama yang mungkin sudah stale)
  const freshIdx = menuData.findIndex(m => m.id === stableId);
  if(freshIdx === -1){ showToast('Item sudah dihapus atau tidak ditemukan','error'); return; }
  menuData.splice(freshIdx, 1);
  renderAdminTables();
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  // FIX v70 #5: sync page-menu publik dan katalog storefront
  if(typeof pmRender==='function') pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  if(typeof renderKatalogGrid==='function') renderKatalogGrid(window._katalogCurrentFilter||'all');
  // FIX v119 #3: sync ke halaman Penjualan
  if(typeof pjRenderMenuGrid==='function') pjRenderMenuGrid();
  showToast('Menu berhasil dihapus!','success');
}

// ============ KATALOG STOREFRONT — SUPERADMIN ============
let _katalogCurrentFilter = 'all';

function renderKatalogGrid(filter){
  filter = filter || 'all';
  _katalogCurrentFilter = filter;
  const grid = document.getElementById('katalog-grid');
  if(!grid) return;
  const items = filter === 'all' ? menuData : menuData.filter(m => m.cat === filter);
  if(!items.length){
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text3);font-size:.85rem">Belum ada menu di kategori ini.<br><button class="btn-save" onclick="katalogOpenModal(-1)" style="margin-top:12px">+ Tambah Menu</button></div>';
    return;
  }
  // FIX v67: render chunked agar tidak freeze UI saat banyak item
  const CHUNK = 6;
  const first = items.slice(0, CHUNK);
  const rest = items.slice(CHUNK);
  function _buildKatalogCard(m){
    const idx = menuData.indexOf(m);
    const safeName = _esc(m.name);
    const safeImg  = _esc(m.img||'');
    const imgHtml = m.img
      ? '<img class="katalog-card-img" data-src="'+safeImg+'" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 240 150\'%3E%3C/svg%3E" alt="'+safeName+'" loading="lazy" style="background:var(--bg2)" onerror="this.removeAttribute(\'data-src\');this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
        + '<div class="katalog-card-img-fallback" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" width="32" height="32" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-30 12 12)"/><path d="M5 9.5c2 1 5 1.5 7 1.5s5-.5 7-1.5"/></svg></div>'
      : '<div class="katalog-card-img-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" width="32" height="32" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-30 12 12)"/><path d="M5 9.5c2 1 5 1.5 7 1.5s5-.5 7-1.5"/></svg></div>';
    return '<div class="katalog-card">'
      + (!m.inStock ? '<div class="katalog-card-oos">STOK HABIS</div>' : '')
      + (m.tags && m.tags.includes('terlaris') ? '<div class="katalog-card-terlaris"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11" style="vertical-align:-.1em"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> Terlaris</div>' : '')
      + imgHtml
      + '<div class="katalog-card-body">'
        + (m.badge ? '<div class="katalog-card-badge">'+_esc(m.badge)+'</div>' : '')
        + '<div class="katalog-card-name" title="'+safeName+'">'+safeName+'</div>'
        + '<div class="katalog-card-price">Rp '+m.price.toLocaleString('id-ID')+'</div>'
        + '<div class="katalog-card-cat">'+_katalogCatLabel(m.cat)+'</div>'
      + '</div>'
      + '<div class="katalog-card-actions">'
        + '<button class="btn-edit" onclick="katalogOpenModal('+idx+')" style="flex:1;font-size:.73rem;padding:7px 0;border-radius:9px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-.1em" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>'
        + '<button class="btn-danger" onclick="katalogHapus('+idx+')" style="flex:1;font-size:.73rem;padding:7px 0;border-radius:9px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="vertical-align:-.1em" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Hapus</button>'
      + '</div>'
    + '</div>';
  }
  grid.innerHTML = first.map(_buildKatalogCard).join('');
  if(rest.length){
    requestAnimationFrame(function(){
      grid.innerHTML += rest.map(_buildKatalogCard).join('');
    });
  }
  // v123: compress gambar katalog admin via canvas (WebP, max 320px)
  requestAnimationFrame(function(){ _applyImgCompress(grid, 320, 320); });
}

function _katalogCatLabel(cat){
  return cat==='birthday'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14" style="vertical-align:-.15em"><rect x="3" y="11" width="18" height="10" rx="2" stroke-linecap="round"/><path d="M3 15h18" stroke-linecap="round"/><path d="M8 11V9" stroke-linecap="round"/><path d="M12 11V9" stroke-linecap="round"/><path d="M16 11V9" stroke-linecap="round"/><path d="M8 9c0-1.5 1-2 1-3" stroke-linecap="round"/><path d="M12 9c0-1.5 1-2 1-3" stroke-linecap="round"/><path d="M16 9c0-1.5 1-2 1-3" stroke-linecap="round"/></svg> Birthday':cat==='original'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13" style="vertical-align:-.12em"><rect x="4" y="8" width="16" height="10" rx="3" stroke-linecap="round"/><path d="M8 8V6a4 4 0 018 0v2" stroke-linecap="round"/><path d="M9 13h6" stroke-linecap="round"/></svg> Original':cat==='goreng'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13" style="vertical-align:-.12em"><path d="M3 12c0-4 3-7 6-7 2 0 3 1 3 1s1-1 3-1c3 0 6 3 6 7s-3 7-9 7-9-3-9-7z" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4M10 12h4" stroke-linecap="round"/></svg> Goreng':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13" style="vertical-align:-.12em"><path d="M4 11c0 0 1-5 8-5s8 5 8 5H4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11h18v1a9 9 0 01-18 0v-1z" stroke-linecap="round"/></svg> Topping';
}

function katalogFilter(cat, btn){
  document.querySelectorAll('.katalog-pill').forEach(p=>p.classList.remove('katalog-pill-active'));
  if(btn) btn.classList.add('katalog-pill-active');
  renderKatalogGrid(cat);
}

// v65: Reset seluruh menu ke DEFAULT_MENU
// FIX v129: ganti confirm() native ke 2-step click pattern (mobile-safe)
var _katalogResetStep = 0, _katalogResetTimer = null;
async function katalogResetToDefault(){
  if(_katalogResetStep === 0){
    _katalogResetStep = 1;
    clearTimeout(_katalogResetTimer);
    _katalogResetTimer = setTimeout(function(){ _katalogResetStep=0; }, 5000);
    showToast('Klik tombol Reset Menu lagi dalam 5 detik untuk konfirmasi. Semua menu custom akan hilang!','error');
    return;
  }
  clearTimeout(_katalogResetTimer);
  _katalogResetStep = 0;
  showToast('Mereset menu ke default...','info');
  menuData.length = 0;
  DEFAULT_MENU.forEach(function(m){ menuData.push(Object.assign({},m)); });
  const sb = getSB();
  if(sb){
    try {
      await sb.from('menu_items').delete().gte('menu_id', 0);
      for(const m of menuData){
        await _katalogSyncToSupabase(m);
      }
    } catch(e){ console.warn('[KD] reset menu supabase error:',e); }
  }
  renderKatalogGrid(_katalogCurrentFilter);
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  renderAdminTables();
  showToast('Menu berhasil direset ke ' + DEFAULT_MENU.length + ' menu default ✓','success');
}

function katalogOpenModal(idx){
  const overlay = document.getElementById('katalog-modal-overlay');
  const titleEl = document.getElementById('katalog-modal-title');
  const idxEl   = document.getElementById('km-idx');
  // Reset form
  katalogResetModal();
  if(idx >= 0 && menuData[idx]){
    const m = menuData[idx];
    idxEl.value = idx;
    titleEl.textContent = 'Edit: ' + m.name;
    document.getElementById('km-nama').value  = m.name || '';
    document.getElementById('km-harga').value = m.price ? m.price.toLocaleString('id-ID') : '';
    document.getElementById('km-desc').value  = m.desc || '';
    document.getElementById('km-kat').value   = m.cat  || 'topping';
    document.getElementById('km-badge').value = m.badge|| '';
    document.getElementById('km-terlaris').checked = !!(m.tags && m.tags.includes('terlaris'));
    document.getElementById('km-instock').checked  = m.inStock !== false;
    document.getElementById('km-instock-label').textContent = m.inStock !== false ? 'Tersedia' : 'Stok Habis';
    document.getElementById('km-img-url').value = m.img || '';
    // Preview gambar existing
    if(m.img){
      const prevImg = document.getElementById('km-img-preview-img');
      const prevIcon= document.getElementById('km-img-preview-icon');
      prevImg.src = m.img;
      prevImg.style.display = 'block';
      if(prevIcon) prevIcon.style.display = 'none';
    }
  } else {
    idxEl.value = -1;
    titleEl.textContent = 'Tambah Menu Baru';
  }
  // FIX v47 FLICKER: double-rAF sebelum .show agar GPU layer siap
  // FIX: hapus body.overflow=hidden — menyebabkan scroll jank di halaman admin
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    overlay.classList.add('show');
  }); });
}

function katalogCloseModal(){
  const overlay = document.getElementById('katalog-modal-overlay');
  overlay.classList.remove('show');
  katalogResetModal();
}

function katalogResetModal(){
  ['km-nama','km-desc','km-badge','km-img-url'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  document.getElementById('km-harga').value = '';
  document.getElementById('km-kat').value = 'topping';
  document.getElementById('km-terlaris').checked = false;
  document.getElementById('km-instock').checked = true;
  document.getElementById('km-instock-label').textContent = 'Tersedia';
  document.getElementById('km-idx').value = -1;
  // Reset preview
  const prevImg  = document.getElementById('km-img-preview-img');
  const prevIcon = document.getElementById('km-img-preview-icon');
  if(prevImg){ prevImg.src=''; prevImg.style.display='none'; }
  if(prevIcon) prevIcon.style.display='block';
  // Reset stored base64
  window._katalogImgBase64 = null;
  window._katalogImgFilename = null;
}

// Preview URL gambar yang di-paste
function katalogPreviewUrl(url){
  const prevImg  = document.getElementById('km-img-preview-img');
  const prevIcon = document.getElementById('km-img-preview-icon');
  if(url && url.startsWith('http')){
    prevImg.src = url;
    prevImg.style.display = 'block';
    if(prevIcon) prevIcon.style.display = 'none';
    window._katalogImgBase64 = null; // URL diutamakan
  } else if(!url){
    prevImg.src='';
    prevImg.style.display='none';
    if(prevIcon) prevIcon.style.display='block';
  }
}

// Handle upload file → convert ke base64 untuk preview lokal
// Catatan: base64 disimpan di window._katalogImgBase64
// Di produksi, upload ke Supabase Storage dan simpan public URL-nya
// SEC v102: validasi tipe file gambar secara berlapis (ekstensi + MIME + magic bytes)
function katalogHandleFileUpload(input){
  const file = input.files && input.files[0];
  if(!file) return;

  // ── LAYER 1: Whitelist ekstensi ──
  const _allowedExts = ['jpg','jpeg','png','gif','webp','heic','heif','avif','bmp','tiff','tif'];
  const _fileExt = (file.name.split('.').pop() || '').toLowerCase();
  if(!_allowedExts.includes(_fileExt)){
    showToast('Format tidak didukung. Gunakan: JPG, PNG, WEBP, GIF, HEIC, AVIF','error');
    input.value = '';
    return;
  }

  // ── LAYER 2: Whitelist MIME type dari browser ──
  const _allowedMimes = ['image/jpeg','image/png','image/gif','image/webp',
                         'image/heic','image/heif','image/avif','image/bmp',
                         'image/tiff','image/x-tiff'];
  if(file.type && !_allowedMimes.includes(file.type.toLowerCase())){
    showToast('Tipe file tidak valid. Hanya file gambar yang diperbolehkan.','error');
    input.value = '';
    return;
  }

  // ── LAYER 3: Cek magic bytes (signature) file ──
  // Baca 12 byte pertama untuk validasi binary header sebelum proses lebih lanjut
  const _headReader = new FileReader();
  _headReader.onload = function(ev){
    const arr = new Uint8Array(ev.target.result);
    const _isValidImg = (function(){
      // JPEG: FF D8 FF
      if(arr[0]===0xFF && arr[1]===0xD8 && arr[2]===0xFF) return true;
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if(arr[0]===0x89 && arr[1]===0x50 && arr[2]===0x4E && arr[3]===0x47) return true;
      // GIF: 47 49 46 38
      if(arr[0]===0x47 && arr[1]===0x49 && arr[2]===0x46 && arr[3]===0x38) return true;
      // WEBP: 52 49 46 46 .. .. .. .. 57 45 42 50
      if(arr[0]===0x52 && arr[1]===0x49 && arr[2]===0x46 && arr[3]===0x46 &&
         arr[8]===0x57 && arr[9]===0x45 && arr[10]===0x42 && arr[11]===0x50) return true;
      // BMP: 42 4D
      if(arr[0]===0x42 && arr[1]===0x4D) return true;
      // TIFF: 49 49 2A 00 atau 4D 4D 00 2A
      if((arr[0]===0x49 && arr[1]===0x49 && arr[2]===0x2A) ||
         (arr[0]===0x4D && arr[1]===0x4D && arr[2]===0x00)) return true;
      // HEIC/HEIF/AVIF: ftyp box — bytes 4-7 = "ftyp"
      if(arr[4]===0x66 && arr[5]===0x74 && arr[6]===0x79 && arr[7]===0x70) return true;
      return false;
    })();

    if(!_isValidImg){
      showToast('File bukan gambar valid. Upload dibatalkan.','error');
      input.value = '';
      return;
    }

    // ── LAYER 4: Cek ukuran setelah validasi ──
    if(file.size > 2*1024*1024){
      showToast('Ukuran file melebihi 2MB. Kompress dulu ya!','error');
      input.value = '';
      return;
    }

    // ── Semua validasi lolos — baca sebagai base64 ──
    const reader = new FileReader();
    reader.onload = function(e){
      const base64 = e.target.result;
      window._katalogImgBase64 = base64;
      window._katalogImgFilename = file.name;
      const prevImg  = document.getElementById('km-img-preview-img');
      const prevIcon = document.getElementById('km-img-preview-icon');
      prevImg.src = base64;
      prevImg.style.display = 'block';
      if(prevIcon) prevIcon.style.display = 'none';
      // Kosongkan field URL karena pakai file upload
      document.getElementById('km-img-url').value = '';
      showToast('Foto dipilih: '+file.name,'success');
    };
    reader.readAsDataURL(file);
  };
  _headReader.readAsArrayBuffer(file.slice(0, 12));
}

// Simpan / Update item menu dari modal katalog
async function katalogSaveItem(){
  const nama  = document.getElementById('km-nama').value.trim();
  const hargaRaw = document.getElementById('km-harga').value.replace(/\./g,'').replace(/[^0-9]/g,'');
  const harga = parseInt(hargaRaw) || 0;
  const desc  = document.getElementById('km-desc').value.trim();
  const kat   = document.getElementById('km-kat').value;
  const badge = document.getElementById('km-badge').value.trim();
  const terlaris = document.getElementById('km-terlaris').checked;
  const inStock  = document.getElementById('km-instock').checked;
  const idx   = parseInt(document.getElementById('km-idx').value);

  if(!nama){ showToast('Nama menu wajib diisi!','error'); document.getElementById('km-nama').focus(); return; }
  if(!harga){ showToast('Harga wajib diisi dan harus > 0!','error'); document.getElementById('km-harga').focus(); return; }
  if(harga > 10000000){ showToast('Harga menu tidak boleh melebihi Rp 10.000.000!','error'); document.getElementById('km-harga').focus(); return; } // BUG-FIX v69 BUG-04

  // Tentukan URL gambar: prioritaskan upload (base64), fallback ke URL field, fallback ke existing
  let imgUrl = '';
  if(window._katalogImgBase64){
    // ── SUPABASE STORAGE UPLOAD ──
    // Jika Supabase tersedia, upload ke bucket 'menu-photos' dan dapatkan public URL
    // Fallback: gunakan base64 langsung (untuk demo / localhost)
    imgUrl = await _katalogUploadImage(window._katalogImgBase64, window._katalogImgFilename);
  } else {
    const urlField = document.getElementById('km-img-url').value.trim();
    if(urlField) imgUrl = urlField;
    else if(idx >= 0 && menuData[idx]) imgUrl = menuData[idx].img || '';
  }

  const tags = terlaris ? ['terlaris'] : [];
  const saveBtn = document.getElementById('katalog-modal-save-btn');
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan…'; }

  if(idx >= 0 && menuData[idx]){
    // UPDATE item existing
    menuData[idx].name    = nama;
    menuData[idx].price   = harga;
    menuData[idx].desc    = desc;
    menuData[idx].cat     = kat;
    menuData[idx].badge   = badge;
    menuData[idx].tags    = tags;
    menuData[idx].inStock = inStock;
    if(imgUrl) menuData[idx].img = imgUrl;
    // Sync ke Supabase (async, non-blocking)
    _katalogSyncToSupabase(menuData[idx]);
    showToast('Menu "'+nama+'" berhasil diupdate','success');
  } else {
    // TAMBAH item baru
    const newId = menuData.length > 0 ? Math.max(...menuData.map(m=>m.id||0)) + 1 : 1;
    // FIX v121 TC-23: auto-derive packaging dari _menuCatToInvKey saat tambah menu baru via katalog
    // Agar stok kemasan terpotong benar meski belum ada kolom packaging di DB
    const _newPkgKey = _menuCatToInvKey(kat, nama);
    const _newPcsPerBox = (function(n){ const m=n.match(/(\d+)\s*[Pp]cs/); return m?parseInt(m[1]):1; })(nama);
    const newItem = {id:newId, name:nama, desc:desc, price:harga, cat:kat, img:imgUrl, badge:badge, tags:tags, inStock:inStock, packaging:_newPkgKey||'', pcsPerBox:_newPcsPerBox};
    menuData.push(newItem);
    _katalogSyncToSupabase(newItem, true);
    if(!/\d+\s*[Pp]cs/.test(nama)){
      showToast('Nama tidak mengandung jumlah pcs. Stok akan terpotong 1 pcs/box.','info');
    } else {
      showToast('Menu "'+nama+'" berhasil ditambahkan','success');
    }
  }

  if(saveBtn){ saveBtn.disabled = false; saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" style="vertical-align:middle;margin-right:4px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>Simpan Perubahan'; }

  katalogCloseModal();
  renderKatalogGrid(_katalogCurrentFilter);
  renderAdminTables();
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  // FIX v119 #1: sync menu baru ke halaman Penjualan
  if(typeof pjRenderMenuGrid === 'function') pjRenderMenuGrid();
}

// Upload ke Supabase Storage 'menu-photos' bucket (jika tersedia)
// Mengembalikan public URL atau base64 sebagai fallback
async function _katalogUploadImage(base64DataUrl, filename){
  try {
    const sb = getSB();
    if(!sb) return base64DataUrl; // fallback ke base64 jika Supabase belum init
    // Convert base64 → Blob
    const arr = base64DataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    const blob = new Blob([u8arr], {type:mime});
    const ext  = mime.split('/')[1] || 'jpg';
    const fname= 'menu_' + Date.now() + '_' + (filename||'photo').replace(/[^a-z0-9._-]/gi,'_') + '.' + ext;
    const { data, error } = await sb.storage.from('menu-photos').upload(fname, blob, {contentType:mime, upsert:false});
    if(error){ console.warn('[KD] Storage upload gagal:', error.message); showToast('⚠️ Upload gambar gagal: bucket menu-photos tidak ada atau tidak public. Gambar disimpan lokal.','error'); return base64DataUrl; }
    const { data:urlData } = sb.storage.from('menu-photos').getPublicUrl(data.path);
    return urlData?.publicUrl || base64DataUrl;
  } catch(e){
    console.warn('[KD] Storage error:', e);
    return base64DataUrl;
  }
}

// Sync item ke Supabase tabel 'menu_items' (upsert berdasarkan id)
async function _katalogSyncToSupabase(item, isNew){
  try {
    const sb = getSB();
    if(!sb) return;
    const row = {
      menu_id:   item.id,
      name:      item.name,
      description: item.desc || '',
      price:     item.price,
      category:  item.cat,
      img_url:   item.img || '',
      badge:     item.badge || '',
      tags:      item.tags || [],
      in_stock:  item.inStock !== false,
      // FIX v121 TC-24: sync packaging & pcs_per_box ke Supabase agar mapping stok kemasan benar
      packaging:   item.packaging || '',
      pcs_per_box: item.pcsPerBox || 0,
      updated_at: new Date().toISOString()
    };
    if(isNew) row.created_at = row.updated_at;
    const { error } = await sb.from('menu_items').upsert(row, {onConflict:'menu_id'});
    if(error) console.warn('[KD] menu_items upsert gagal:', error.message);
  } catch(e){ console.warn('[KD] Supabase sync error:', e); }
}

// Hapus menu dari katalog (dengan double-confirm)
function katalogHapus(idx){
  const item = menuData[idx];
  if(!item){ showToast('Item tidak ditemukan, refresh halaman','error'); return; }
  const stableId = item.id;
  const name = item.name;
  if(!window._katalogDelConfirm || window._katalogDelPendingId !== stableId){
    window._katalogDelConfirm = true;
    window._katalogDelPendingId = stableId;
    showToast('Klik "Hapus" lagi untuk konfirmasi hapus '+name,'error');
    setTimeout(()=>{ window._katalogDelConfirm=false; window._katalogDelPendingId=null; }, 3500);
    return;
  }
  window._katalogDelConfirm = false;
  window._katalogDelPendingId = null;
  // Cari ulang by id (bukan idx lama yang bisa stale)
  const freshIdx = menuData.findIndex(m => m.id === stableId);
  if(freshIdx === -1){ showToast('Item sudah dihapus','error'); return; }
  // Hapus dari Supabase (async)
  (async()=>{
    try{
      const sb=getSB();
      if(!sb) return;
      const {error}=await sb.from('menu_items').delete().eq('menu_id',stableId);
      if(error) console.error('[KD] hapus menu_items:',error.message);
    }catch(e){ console.error('[KD] hapus menu error:',e); }
  })();
  menuData.splice(freshIdx, 1);
  renderKatalogGrid(_katalogCurrentFilter);
  renderAdminTables();
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  // FIX v119 #4: sync ke halaman Penjualan
  if(typeof pjRenderMenuGrid==='function') pjRenderMenuGrid();
  showToast('Menu "'+name+'" berhasil dihapus!','success');
}

// Toggle stok langsung dari label di modal katalog
document.addEventListener('DOMContentLoaded', function(){
  const stockCheck = document.getElementById('km-instock');
  if(stockCheck){
    stockCheck.addEventListener('change', function(){
      const lbl = document.getElementById('km-instock-label');
      if(lbl) lbl.textContent = this.checked ? 'Tersedia' : 'Stok Habis';
    });
  }
});


// ---- CABANG ----
let cabangFormOpen=false;
function toggleAddCabang(){
  cabangFormOpen=!cabangFormOpen;
  let f=document.getElementById('add-cabang-form');
  if(!f){
    f=document.createElement('div');
    f.id='add-cabang-form';
    f.className='add-form-box';
    f.innerHTML=`
      <h3 id="cb-form-title">Tambah Cabang Baru</h3>
      <input type="hidden" id="cb-edit-idx" value="-1">
      <div class="admin-form-grid" style="margin-bottom:12px">
        <div class="form-group"><label>Nama Cabang</label><input type="text" id="cb-nama" class="login-input" style="margin:0;padding:9px 11px" placeholder="Kampung Dimsum XX"></div>
        <div class="form-group"><label>Alamat</label><input type="text" id="cb-addr" class="login-input" style="margin:0;padding:9px 11px" placeholder="Jl. ..."></div>
        <div class="form-group"><label>Jam Buka</label><input type="text" id="cb-jam" class="login-input" style="margin:0;padding:9px 11px" placeholder="08.00–21.00"></div>
        <div class="form-group"><label>No WhatsApp</label><input type="text" id="cb-wa" class="login-input" style="margin:0;padding:9px 11px" placeholder="628xxx"></div>
        <div class="form-group"><label>Link Google Maps</label><input type="text" id="cb-maps" class="login-input" style="margin:0;padding:9px 11px" placeholder="https://maps.app.goo.gl/..."></div>
        <div class="form-group"><label>Tipe</label><select id="cb-type" class="login-input" style="margin:0;padding:9px 11px"><option value="cabang">Cabang</option><option value="agen">Agen</option><option value="produksi">Rumah Produksi</option></select></div>
      </div>
      <div style="display:flex;gap:9px">
        <button class="btn-save" onclick="saveCabang()">Simpan</button>
        <button class="btn-danger" onclick="toggleAddCabang()">Batal</button>
      </div>`;
    const panel=document.getElementById('panel-cabang-mgmt');
    const tbl=panel.querySelector('.admin-table-wrap');
    panel.insertBefore(f,tbl);
  }
  f.style.display=cabangFormOpen?'block':'none';
  if(cabangFormOpen&&document.getElementById('cb-edit-idx').value==='-1'){
    ['cb-nama','cb-addr','cb-jam','cb-wa','cb-maps'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('cb-type').value='cabang';
  }
}

function saveCabang(){
  const nama=document.getElementById('cb-nama').value.trim();
  const addr=document.getElementById('cb-addr').value.trim();
  const editIdx=parseInt(document.getElementById('cb-edit-idx').value);
  if(!nama||!addr){showToast('Nama dan alamat wajib diisi!','error');return;}
  const obj={
    name:nama,addr:addr,
    jam:document.getElementById('cb-jam').value||'08.00–21.00',
    rating:5,wa:document.getElementById('cb-wa').value||'6285133355583',
    open:true,lat:0,lng:0,
    mapsUrl:document.getElementById('cb-maps').value||'',
    type:document.getElementById('cb-type').value||'cabang'
  };
  // FIX: simpan nama LAMA sebelum Object.assign agar WHERE clause Supabase pakai nama lama
  // Race condition lama: Object.assign() ubah nama dulu → .eq('name', nama_baru) → row tidak ketemu
  const _oldCabangName = editIdx>=0 ? (cabangData[editIdx]?.name || obj.name) : null;
  if(editIdx>=0){
    Object.assign(cabangData[editIdx],obj);
    showToast('Cabang berhasil diupdate','success');
  } else {
    obj.id=String(cabangData.length+1).padStart(2,'0');
    cabangData.push(obj);
    showToast('Cabang baru berhasil ditambahkan','success');
  }
  // Sync cabangGeo
  cabangGeo=cabangData.map(function(c){return{lat:c.lat,lng:c.lng,name:c.name,addr:c.addr,jam:c.jam,rating:c.rating,wa:c.wa,open:c.open,mapsUrl:c.mapsUrl,type:c.type};});
  if(mapInstance){mapInstance.remove();mapInstance=null;}
  const pjSel=document.getElementById('pj-cabang');
  if(pjSel) pjSel.innerHTML='<option value="">— Pilih Cabang —</option>'+cabangData.map(c=>`<option value="${c.name}">${_esc(c.name)}</option>`).join('');
  const skSel=document.getElementById('sk-cabang');
  if(skSel){
    // v124b FIX: tetap sertakan opsi __SEMUA__ agar distribusi ke semua cabang tetap bisa dilakukan
    const sortedForSk = [...cabangData].sort((a,b)=>(parseInt(a.id)||999)-(parseInt(b.id)||999));
    skSel.innerHTML='<option value="__SEMUA__">Semua Cabang</option>'+sortedForSk.map(c=>`<option value="${c.name}">${_esc(c.name)}</option>`).join('');
  }
  renderAdminTables();renderCabang();
  // v89: sync ke Supabase
  (async function(){
    const sb=getSB(); if(!sb) return;
    const row={name:obj.name,addr:obj.addr,jam:obj.jam,rating:obj.rating,wa:obj.wa,
               open:obj.open,lat:obj.lat,lng:obj.lng,maps_url:obj.mapsUrl,type:obj.type};
    const {error}= editIdx>=0
      ? await sb.from('cabang').update(row).eq('name', _oldCabangName)
      : await sb.from('cabang').insert(row);
    if(error) console.warn('[KD] saveCabang DB error:',error.message);
    else _sbLogActivity(editIdx>=0?`Update cabang: ${obj.name}`:`Tambah cabang: ${obj.name}`);
  })();
  document.getElementById('cb-edit-idx').value='-1';
  cabangFormOpen=false;
  document.getElementById('add-cabang-form').style.display='none';
}

function editCabang(idx){
  // ✅ BUG FIX #9 (LOW) — QA: cabangFormOpen state bisa ambiguous saat Edit diklik ketika form sudah terbuka
  // FIX: selalu force state display=block + cabangFormOpen=true tanpa bergantung state lama
  const c=cabangData[idx];
  if(!document.getElementById('add-cabang-form')){
    // Form belum ada di DOM, buat dulu via toggleAddCabang
    cabangFormOpen=false; // pastikan toggleAddCabang akan set ke true
    toggleAddCabang();
  } else {
    document.getElementById('add-cabang-form').style.display='block';
    cabangFormOpen=true;
  }
  setTimeout(()=>{
    document.getElementById('cb-edit-idx').value=idx;
    document.getElementById('cb-nama').value=c.name;
    document.getElementById('cb-addr').value=c.addr;
    document.getElementById('cb-jam').value=c.jam;
    document.getElementById('cb-wa').value=c.wa;
    document.getElementById('cb-maps').value=c.mapsUrl||'';
    document.getElementById('cb-type').value=c.type||'cabang';
    const fh=document.getElementById('cb-form-title');if(fh)fh.textContent='Edit Cabang: '+c.name;
    document.getElementById('add-cabang-form').scrollIntoView({behavior:'smooth',block:'nearest'});
  },50);
}

function hapusCabang(idx){
  // ✅ BUG FIX #2 (MEDIUM) — sama seperti hapusMenu: simpan idx target agar tidak hapus cabang salah
  const name=cabangData[idx].name;
  if(!window._cbDelConfirm || window._cbDelPendingIdx !== idx){
    window._cbDelConfirm=true;
    window._cbDelPendingIdx=idx;
    showToast('Klik "Hapus" lagi untuk konfirmasi hapus '+name,'error');
    setTimeout(()=>{window._cbDelConfirm=false;window._cbDelPendingIdx=-1;},3500);
    return;
  }
  window._cbDelConfirm=false;
  window._cbDelPendingIdx=-1;
  const delName=cabangData[idx].name;
  cabangData.splice(idx,1);
  cabangGeo=cabangData.map(function(c){return{lat:c.lat,lng:c.lng,name:c.name,addr:c.addr,jam:c.jam,rating:c.rating,wa:c.wa,open:c.open,mapsUrl:c.mapsUrl,type:c.type};});
  if(mapInstance){mapInstance.remove();mapInstance=null;}
  renderAdminTables();renderCabang();
  showToast('Cabang berhasil dihapus!','success');
  // v89: hapus dari Supabase
  (async function(){
    const sb=getSB(); if(!sb) return;
    const {error}=await sb.from('cabang').delete().eq('name',delName);
    if(error) console.warn('[KD] hapusCabang DB error:',error.message);
    else _sbLogActivity(`Hapus cabang: ${delName}`);
  })();
}

// ---- FORMAT OMSET ----
function fmtRp(val){return'Rp '+parseInt(val||0).toLocaleString('id-ID');}

// ---- PROMO CRUD ----
// ✅ BUG FIX #1 (CRITICAL) — QA: tidak ada fungsi untuk edit/hapus/tambah promo
// Keempat fungsi di bawah JANGAN dihapus — dipakai oleh tbl-promo-mgmt dan form #add-promo-form
let promoFormOpen = false;
function toggleAddPromo(){
  promoFormOpen = !promoFormOpen;
  const f = document.getElementById('add-promo-form');
  if(!f) return;
  f.style.display = promoFormOpen ? 'block' : 'none';
  if(promoFormOpen){
    // Reset ke mode tambah baru
    document.getElementById('promo-edit-idx').value = '-1';
    document.getElementById('promo-form-title').textContent = 'Tambah Promo Baru';
    ['promo-tag','promo-title','promo-expire','promo-desc'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
  }
}
async function savePromo(){
  const tag   = document.getElementById('promo-tag').value.trim();
  const title = document.getElementById('promo-title').value.trim();
  const desc  = document.getElementById('promo-desc').value.trim();
  const exp   = document.getElementById('promo-expire').value.trim();
  const editIdx = parseInt(document.getElementById('promo-edit-idx').value);
  if(!tag || !title){ showToast('Tag dan judul promo wajib diisi!','error'); return; }
  // FIX v70 #2: baca warna dari select picker, bukan dari promoData index yg bisa salah
  const colorEl = document.getElementById('promo-color');
  const color = colorEl ? colorEl.value : (promoData[editIdx>=0 ? editIdx : 0]?.color || 'linear-gradient(135deg,#7B1A1A,#2C0A0A)');
  const obj = { tag, title, desc: desc||'-', expire: exp||'-', color };
  if(editIdx >= 0){
    const existingId = promoData[editIdx].id;
    obj.active = promoData[editIdx].active !== false; // pertahankan status aktif
    obj.sort_order = promoData[editIdx].sort_order || editIdx;
    Object.assign(promoData[editIdx], obj);
    _persistPromo();
    renderAdminTables();
    renderPromo();
    showToast('Menyimpan ke database...','success');
    const saved = await _savePromoToSupabase(obj, existingId);
    if(saved){ promoData[editIdx].id = saved.id; _persistPromo(); showToast('Promo berhasil diupdate ✓','success'); }
  } else {
    obj.active = true;
    obj.sort_order = promoData.length;
    promoData.push(obj);
    _persistPromo();
    renderAdminTables();
    renderPromo();
    showToast('Menyimpan ke database...','success');
    const saved = await _savePromoToSupabase(obj, null);
    if(saved){ promoData[promoData.length-1].id = saved.id; _persistPromo(); showToast('Promo baru berhasil ditambahkan ✓','success'); }
  }
  promoFormOpen = false;
  document.getElementById('add-promo-form').style.display = 'none';
}
function editPromo(idx){
  const p = promoData[idx];
  const f = document.getElementById('add-promo-form');
  if(!f) return;
  promoFormOpen = true;
  f.style.display = 'block';
  document.getElementById('promo-edit-idx').value = idx;
  document.getElementById('promo-form-title').textContent = 'Edit Promo: ' + p.title;
  document.getElementById('promo-tag').value   = p.tag;
  document.getElementById('promo-title').value = p.title;
  document.getElementById('promo-desc').value  = p.desc;
  document.getElementById('promo-expire').value= p.expire;
  // FIX v70 #2: set color select sesuai warna promo yang ada
  const colorEl = document.getElementById('promo-color');
  if(colorEl && p.color){
    const match = Array.from(colorEl.options).find(o => o.value === p.color);
    colorEl.value = match ? p.color : colorEl.options[0].value;
  }
  f.scrollIntoView({behavior:'smooth', block:'nearest'});
}
async function hapusPromo(idx){
  const name = promoData[idx].title;
  // Double-confirm dengan flag terpisah agar tidak bentrok dengan _menuDelConfirm
  if(!window._promoDelConfirm || window._promoDelPendingIdx !== idx){
    window._promoDelConfirm = true;
    window._promoDelPendingIdx = idx;
    showToast('Klik "Hapus" lagi untuk konfirmasi hapus promo: '+name,'error');
    setTimeout(()=>{ window._promoDelConfirm=false; window._promoDelPendingIdx=-1; },3500);
    return;
  }
  window._promoDelConfirm = false;
  const deletedId = promoData[idx].id;
  promoData.splice(idx, 1);
  _persistPromo();
  renderAdminTables();
  renderPromo();
  showToast('Menghapus dari database...','error');
  await _deletePromoFromSupabase(deletedId);
  showToast('Promo berhasil dihapus ✓','success');
}

// ---- FRANCHISE CRUD ----
// BUG-C4 FIX: tombol Proses & Tolak sebelumnya dead buttons tanpa handler
function prosesApplicant(idx){
  const _fr = window._franchiseApplicants || franchiseApplicants;
  if(!_fr[idx]) return;
  const rec = _fr[idx];
  rec.status = 'Diproses';
  renderAdminTables();
  showToast(`Permohonan ${rec.nama} sedang diproses`,'success');
  // v89: update ke Supabase
  (async function(){
    const sb=getSB(); if(!sb||!rec.id) return;
    const {error}=await sb.from('franchise_applications').update({status:'Diproses'}).eq('id',rec.id);
    if(error) console.warn('[KD] proses applicant error:',error.message);
    else _sbLogActivity(`Proses franchise: ${rec.nama}`);
  })();
}
function tolakApplicant(idx){
  const _fr = window._franchiseApplicants || franchiseApplicants;
  if(!_fr[idx]) return;
  const rec = _fr[idx];
  const name = rec.nama;
  if(!window._franchiseDelConfirm || window._franchiseDelPendingIdx !== idx){
    window._franchiseDelConfirm = true;
    window._franchiseDelPendingIdx = idx;
    showToast(`Klik "Tolak" lagi untuk konfirmasi tolak ${name}`,'error');
    setTimeout(()=>{ window._franchiseDelConfirm=false; window._franchiseDelPendingIdx=-1; },3500);
    return;
  }
  window._franchiseDelConfirm = false;
  rec.status = 'Ditolak';
  renderAdminTables();
  showToast(`Permohonan ${name} ditolak.`,'error');
  // v89: update ke Supabase
  (async function(){
    const sb=getSB(); if(!sb||!rec.id) return;
    const {error}=await sb.from('franchise_applications').update({status:'Ditolak'}).eq('id',rec.id);
    if(error) console.warn('[KD] tolak applicant error:',error.message);
    else _sbLogActivity(`Tolak franchise: ${name}`);
  })();
}

// ============ CHARTS ============
const chartInstances={};
function destroyAllCharts(){Object.keys(chartInstances).forEach(k=>{if(chartInstances[k]){chartInstances[k].destroy();delete chartInstances[k];}});}
function chartTheme(){const isDark=document.documentElement.getAttribute('data-theme')==='dark';return{text:isDark?'rgba(255,255,255,.42)':'rgba(0,0,0,.42)',grid:isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)'};}
function scaleOpts(th){return{x:{ticks:{color:th.text,font:{size:10}},grid:{color:th.grid}},y:{ticks:{color:th.text,font:{size:10}},grid:{color:th.grid}}};}

function initCharts(){
  destroyAllCharts();
  const th=chartTheme(),sc=scaleOpts(th);
  const palette=['#B83232','#D4963A','#4E7FC4','#3A9E6E','#C4704E','#7B5FC4'];
  const paletteAlpha=(i,a)=>{const h=palette[i].replace('#','');const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return`rgba(${r},${g},${b},${a})`;};

  // v70: chart-omset — init dengan timeframe engine ('1D' = hari ini per jam)
  const c1=document.getElementById('chart-omset');
  if(c1){
    const { labels:l1, data:d1, unit:u1 } = _omsetByPeriod(_chartPeriod.omset);
    const a1 = l1.map((_,i,arr)=>{ const b=0.45+(i/(arr.length-1||1))*0.55; return 'rgba(184,50,50,'+b.toFixed(2)+')'; });
    chartInstances['chart-omset']=new Chart(c1,{type:'bar',data:{labels:l1,datasets:[{label:'Omset',data:d1.some(v=>v>0)?d1:l1.map(()=>0),backgroundColor:a1,borderColor:'transparent',borderWidth:0,borderRadius:{topLeft:6,topRight:6},borderSkipped:false}]},options:{responsive:true,animation:{duration:300},plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>(ctx.raw>0?'Rp '+ctx.raw+' '+u1:'Belum ada data')}}},scales:{x:{ticks:{color:th.text,font:{size:10,family:'DM Sans'},maxRotation:0},grid:{display:false}},y:{ticks:{color:th.text,font:{size:10,family:'DM Sans'},callback:v=>v+u1},grid:{color:th.grid}}}}});
  }

  // v70: chart-cabang — init dengan timeframe engine
  const c2=document.getElementById('chart-cabang');
  if(c2){
    const perCab={};
    omsetHistory.forEach(o=>{ perCab[o.cabang]=(perCab[o.cabang]||0)+o.omset; });
    const cabEntries=Object.entries(perCab).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const hasData=cabEntries.length>0;
    chartInstances['chart-cabang']=new Chart(c2,{type:'doughnut',data:{labels:hasData?cabEntries.map(([n])=>n.replace('Kampung Dimsum ','KD ')):['Belum ada data'],datasets:[{data:hasData?cabEntries.map(([,v])=>Math.round(v/1000000*10)/10):[1],backgroundColor:hasData?palette:['rgba(200,200,200,.3)'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,animation:{duration:300},cutout:'66%',plugins:{legend:{labels:{color:th.text,font:{size:10,family:'DM Sans'},boxWidth:10,padding:10,usePointStyle:true,pointStyle:'circle'}},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>hasData?ctx.label+': Rp '+ctx.raw+' Jt':'Belum ada data omset'}}}}});
  }

  // v70: chart-produk — init dengan timeframe engine
  const c3=document.getElementById('chart-produk');
  if(c3){
    const menuCount={};
    penjualanData.forEach(p=>{(p.items||[]).forEach(item=>{ menuCount[item.name]=(menuCount[item.name]||0)+item.qty; });});
    const menuTop=Object.entries(menuCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
    chartInstances['chart-produk']=new Chart(c3,{type:'bar',data:{labels:menuTop.length?menuTop.map(([n])=>n):['Belum ada data'],datasets:[{data:menuTop.length?menuTop.map(([,v])=>v):[0],backgroundColor:palette,borderRadius:{topLeft:0,topRight:5,bottomLeft:0,bottomRight:5},borderSkipped:false}]},options:{indexAxis:'y',responsive:true,animation:{duration:300},plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8}},scales:{x:{ticks:{color:th.text,font:{size:10,family:'DM Sans'}},grid:{color:th.grid}},y:{ticks:{color:th.text,font:{size:10,family:'DM Sans'}},grid:{display:false}}}}});
  }

  // v70: chart-payment — init dengan timeframe engine
  const c4=document.getElementById('chart-payment');
  if(c4){
    const payCount={};
    penjualanData.forEach(p=>{ payCount[p.bayar]=(payCount[p.bayar]||0)+1; });
    const payEntries=Object.entries(payCount).sort((a,b)=>b[1]-a[1]);
    chartInstances['chart-payment']=new Chart(c4,{type:'doughnut',data:{labels:payEntries.length?payEntries.map(([n])=>n):['QRIS','Tunai','Transfer'],datasets:[{data:payEntries.length?payEntries.map(([,v])=>v):[0,0,0],backgroundColor:palette.slice(0,Math.max(payEntries.length,1)),borderWidth:0,hoverOffset:6}]},options:{responsive:true,animation:{duration:300},cutout:'58%',plugins:{legend:{labels:{color:th.text,font:{size:10,family:'DM Sans'},boxWidth:10,padding:8,usePointStyle:true,pointStyle:'circle'}},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8}}}});
  }
  // Setelah semua chart init, apply data aktif sesuai period yang dipilih
  setTimeout(function(){
    _refreshOmsetChart();
    _refreshCabangChart();
    _refreshProdukChart();
    _refreshPaymentChart();
  }, 50);
}
// ============ ANALITIK KPI CARDS — DATA REAL dari omsetHistory & penjualanData ============
function renderAnalitikKPICards(){
  // v128 FIX: fallback ke penjualanData jika omsetHistory kosong (seperti _calcSaTodayOmset di dashboard)
  var nowAn = new Date();
  var thisPrefixAn = nowAn.getFullYear()+'-'+String(nowAn.getMonth()+1).padStart(2,'0');
  // Jika omsetHistory kosong, bangun dari penjualanData (belum sync ke omset_entries)
  let _syntheticOmset = omsetHistory;
  if(!omsetHistory.length && penjualanData.length){
    _syntheticOmset = penjualanData.map(p=>({tanggal:(p.tanggal||'').slice(0,10),cabang:p.cabang||'',omset:p.total||0,trx:1}));
  }
  const omsetBulanIniAn = _syntheticOmset.filter(o=>o.tanggal&&o.tanggal.startsWith(thisPrefixAn));
  const totalOmset = omsetBulanIniAn.reduce((s,o)=>s+o.omset,0);
  const totalTrxBulan = omsetBulanIniAn.reduce((s,o)=>s+o.trx,0);
  const totalTrx = _syntheticOmset.reduce((s,o)=>s+o.trx,0); // all-time untuk kartu Total Trx
  const uniqueDays = new Set(omsetBulanIniAn.map(o=>o.tanggal.slice(0,10))).size || 1;
  const avgOmset   = totalOmset > 0 ? Math.round(totalOmset / uniqueDays) : 0;
  const avgTrx     = totalTrxBulan > 0 && totalOmset > 0
    ? Math.round(totalOmset / totalTrxBulan) : 0;

  // Cabang terbaik bulan ini (termasuk Rumah Produksi)
  const perCabang = {};
  omsetBulanIniAn.forEach(o=>{
    if(!perCabang[o.cabang]) perCabang[o.cabang]=0;
    perCabang[o.cabang]+=o.omset;
  });
  const cabangEntries = Object.entries(perCabang).sort((a,b)=>b[1]-a[1]);
  const bestCab = cabangEntries[0];

  const setEl = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  const setCls= (id,cls)=>{ const el=document.getElementById(id); if(el) el.className='kpi-change '+(cls||''); };

  if(_syntheticOmset.length === 0){
    setEl('an-kpi-avg-omset','—');
    setEl('an-kpi-avg-omset-sub','Belum ada data');
    setEl('an-kpi-best-cab','—');
    setEl('an-kpi-best-cab-sub','Belum ada data');
    setEl('an-kpi-avg-trx','—');
    setEl('an-kpi-avg-trx-sub','Belum ada transaksi');
    setEl('an-kpi-total-trx','—');
    setEl('an-kpi-total-trx-sub','Belum ada data');
  } else {
    setEl('an-kpi-avg-omset', totalOmset > 0 ? 'Rp '+_fmtJuta(avgOmset) : '—');
    setEl('an-kpi-avg-omset-sub', uniqueDays+' hari · bulan ini');
    setCls('an-kpi-avg-omset-sub', totalOmset > 0 ? 'up' : '');
    setEl('an-kpi-best-cab', bestCab ? bestCab[0].replace('Kampung Dimsum ','KD ') : '—');
    setEl('an-kpi-best-cab-sub', bestCab ? 'Rp '+_fmtJuta(bestCab[1])+' bulan ini' : 'Belum ada data bulan ini');
    setEl('an-kpi-avg-trx', avgTrx > 0 ? 'Rp '+_fmtJuta(avgTrx) : '—');
    setEl('an-kpi-avg-trx-sub', avgTrx > 0 ? 'rata-rata/transaksi' : 'Data dari kasir');
    setEl('an-kpi-total-trx', totalTrx.toLocaleString('id-ID'));
    setEl('an-kpi-total-trx-sub', 'semua waktu · semua cabang');
  }

  // ── Mini bars: menu terjual terbanyak dari penjualanData ──
  const menuBarsEl = document.getElementById('an-menu-bars');
  if(menuBarsEl){
    const menuCount = {};
    penjualanData.forEach(p=>{ (p.items||[]).forEach(item=>{ menuCount[item.name]=(menuCount[item.name]||0)+item.qty; }); });
    const menuTop = Object.entries(menuCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(!menuTop.length){
      menuBarsEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text4);font-size:.8rem">Belum ada data penjualan</div>';
    } else {
      const maxVal = menuTop[0][1];
      menuBarsEl.innerHTML = menuTop.map(([name,qty])=>`
        <div class="analytics-item">
          <div class="analytics-item-top">
            <span class="analytics-item-name">${name}</span>
            <span class="analytics-val">${qty.toLocaleString('id-ID')}</span>
          </div>
          <div class="analytics-bar-bg"><div class="analytics-bar" style="width:${Math.round(qty/maxVal*100)}%"></div></div>
        </div>`).join('');
    }
  }

  // ── Mini bars: omset per cabang ──
  const cabBarsEl = document.getElementById('an-cabang-bars');
  if(cabBarsEl){
    if(!cabangEntries.length){
      cabBarsEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text4);font-size:.8rem">Belum ada data omset</div>';
    } else {
      const maxCab = cabangEntries[0][1];
      cabBarsEl.innerHTML = cabangEntries.slice(0,5).map(([name,omset])=>`
        <div class="analytics-item">
          <div class="analytics-item-top">
            <span class="analytics-item-name">${name.replace('Kampung Dimsum ','KD ')}</span>
            <span class="analytics-val">Rp ${_fmtJuta(omset)}</span>
          </div>
          <div class="analytics-bar-bg"><div class="analytics-bar" style="width:${Math.round(omset/maxCab*100)}%"></div></div>
        </div>`).join('');
    }
  }

  // ── Payment grid dari penjualanData ──
  const payEl = document.getElementById('an-payment-grid');
  if(payEl){
    const payCount = {};
    penjualanData.forEach(p=>{ payCount[p.bayar]=(payCount[p.bayar]||0)+1; });
    const payEntries = Object.entries(payCount).sort((a,b)=>b[1]-a[1]);
    if(!payEntries.length){
      payEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text4);font-size:.8rem;grid-column:1/-1">Belum ada transaksi</div>';
    } else {
      payEl.innerHTML = payEntries.map(([bayar,count])=>`
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 8px;text-align:center">
          <div style="font-family:'Inter',sans-serif;font-size:1.3rem;font-weight:800;color:var(--text);letter-spacing:-.02em">${count}</div>
          <div style="font-size:.65rem;color:var(--text3);margin-top:2px">${bayar}</div>
        </div>`).join('');
    }
  }
}

function initAnalitikCharts(){
  const th=chartTheme();
  const trendColors=[['#B83232','rgba(184,50,50,.08)'],['#D4963A','rgba(212,150,58,.06)'],['#4E7FC4','rgba(78,127,196,.06)'],['#3A9E6E','rgba(58,158,110,.06)'],['#C4704E','rgba(196,112,78,.06)']];

  // ── chart-trend: Tren omset 6 bulan per cabang (real data) ──
  const ct=document.getElementById('chart-trend');
  if(ct){
    if(chartInstances['chart-trend']) chartInstances['chart-trend'].destroy();
    // Hitung 6 bulan terakhir
    const now=new Date();
    const trendLabels=[], trendMonths=[];
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      trendLabels.push(d.toLocaleDateString('id-ID',{month:'short'}));
      trendMonths.push(d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1));
    }
    // Ambil top 3 cabang berdasarkan total omset 6 bulan
    const perCab={};
    omsetHistory.forEach(o=>{
      const mo=o.tanggal&&o.tanggal.slice(0,7);
      if(trendMonths.includes(mo)){
        if(!perCab[o.cabang]) perCab[o.cabang]=0;
        perCab[o.cabang]+=(o.omset||0);
      }
    });
    const top3=Object.entries(perCab).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const datasets = top3.length ? top3.map(([cabName],idx)=>{
      const data=trendMonths.map(mo=>
        Math.round(omsetHistory.filter(o=>o.cabang===cabName&&o.tanggal&&o.tanggal.slice(0,7)===mo).reduce((s,o)=>s+(o.omset||0),0)/1000000*10)/10
      );
      return {label:cabName.replace('Kampung Dimsum ','KD '),data,borderColor:trendColors[idx][0],backgroundColor:trendColors[idx][1],tension:.4,fill:idx===0,pointRadius:5,pointBackgroundColor:trendColors[idx][0],pointBorderColor:'#fff',pointBorderWidth:2};
    }) : [{label:'Belum ada data',data:trendMonths.map(()=>0),borderColor:'rgba(184,50,50,.3)',backgroundColor:'rgba(184,50,50,.04)',tension:.4,fill:true,pointRadius:0}];
    chartInstances['chart-trend']=new Chart(ct,{type:'line',data:{labels:trendLabels,datasets},options:{responsive:true,plugins:{legend:{labels:{color:th.text,font:{size:10,family:'DM Sans'},boxWidth:10,usePointStyle:true,pointStyle:'circle'}},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>'Rp '+ctx.raw+' Jt'}}},scales:{x:{ticks:{color:th.text,font:{size:10,family:'DM Sans'}},grid:{color:th.grid}},y:{ticks:{color:th.text,font:{size:10,family:'DM Sans'},callback:v=>'Rp '+v+' Jt'},grid:{color:th.grid}}}}});
  }

  // ── chart-dayofweek: Omset per hari dalam seminggu (real data) ──
  const cd=document.getElementById('chart-dayofweek');
  if(cd){
    if(chartInstances['chart-dayofweek']) chartInstances['chart-dayofweek'].destroy();
    // DOW: 0=Min,1=Sen,...,6=Sab. Urutkan Sen=1..Sab=6,Min=0 → index 0-6
    const dowTotals=[0,0,0,0,0,0,0]; // index 0=Sen,1=Sel,...,6=Min
    omsetHistory.forEach(o=>{
      if(!o.tanggal) return;
      const d=new Date(o.tanggal.slice(0,10)+'T00:00:00');
      const dow=d.getDay(); // 0=Min,1=Sen,...,6=Sab
      const idx=dow===0?6:dow-1; // Konversi: Min→6, Sen→0, Sel→1,...
      dowTotals[idx]+=(o.omset||0);
    });
    // Fallback pakai penjualanData jika omsetHistory kosong
    if(omsetHistory.length===0){
      penjualanData.forEach(p=>{
        if(!p.tanggal) return;
        const d=new Date(p.tanggal.slice(0,10)+'T00:00:00');
        const dow=d.getDay();
        const idx=dow===0?6:dow-1;
        dowTotals[idx]+=(p.total||0);
      });
    }
    const dowColors=['rgba(184,50,50,.45)','rgba(184,50,50,.5)','rgba(184,50,50,.45)','rgba(184,50,50,.6)','rgba(184,50,50,.75)','rgba(184,50,50,1)','rgba(184,50,50,.9)'];
    chartInstances['chart-dayofweek']=new Chart(cd,{type:'bar',data:{labels:['Sen','Sel','Rab','Kam','Jum','Sab','Min'],datasets:[{label:'Total Omset',data:dowTotals,backgroundColor:dowColors,borderColor:'transparent',borderWidth:0,borderRadius:{topLeft:5,topRight:5},borderSkipped:false}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>'Total: Rp '+ctx.raw.toLocaleString('id-ID')}}},scales:{x:{ticks:{color:th.text,font:{size:10,family:'DM Sans'}},grid:{display:false}},y:{ticks:{color:th.text,font:{size:10,family:'DM Sans'},callback:v=>'Rp '+_fmtJuta(v)},grid:{color:th.grid}}}}});
  }

  // ── chart-growth: Pertumbuhan bulan ke bulan real ──
  const cg=document.getElementById('chart-growth');
  if(cg){
    if(chartInstances['chart-growth']) chartInstances['chart-growth'].destroy();
    // Hitung omset tiap bulan (6 bulan) lalu hitung % perubahan
    const now=new Date();
    const growthLabels=[], growthData=[], growthMonths=[];
    for(let i=6;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      growthMonths.push(d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1));
    }
    const monthTotals=growthMonths.map(mo=>
      omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,7)===mo).reduce((s,o)=>s+(o.omset||0),0)
    );
    // Hitung pertumbuhan dari bulan i-1 ke i (mulai bulan ke-2)
    for(let i=1;i<growthMonths.length;i++){
      const prev=monthTotals[i-1], curr=monthTotals[i];
      const d=new Date(now.getFullYear(),now.getMonth()-(growthMonths.length-1-i),1);
      growthLabels.push(d.toLocaleDateString('id-ID',{month:'short'}));
      if(prev>0) growthData.push(Math.round((curr-prev)/prev*1000)/10);
      else growthData.push(null);
    }
    chartInstances['chart-growth']=new Chart(cg,{type:'line',data:{labels:growthLabels,datasets:[{label:'Pertumbuhan %',data:growthData,borderColor:'#3A9E6E',backgroundColor:'rgba(58,158,110,.08)',tension:.4,fill:true,pointRadius:6,pointBackgroundColor:'#3A9E6E',pointBorderColor:'#fff',pointBorderWidth:2,spanGaps:false}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(58,158,110,.35)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>ctx.raw!==null?ctx.raw+'%':'Belum cukup data'}}},scales:{x:{ticks:{color:th.text,font:{size:10,family:'DM Sans'}},grid:{color:th.grid}},y:{ticks:{color:th.text,font:{size:10,family:'DM Sans'},callback:v=>v+'%'},grid:{color:th.grid}}}}});
  }

  // NOTE: blok chart-payment dihapus dari sini — canvas #chart-payment adalah
  // milik panel Dashboard (initCharts/_refreshPaymentChart), bukan panel Analitik.
  // Panel Analitik menampilkan data pembayaran via grid angka (renderAnalitikKPICards),
  // jadi tidak perlu (dan tidak boleh) membuat Chart baru di canvas tersebut di sini.
}
// ============================================================
// v70 — TIMEFRAME ENGINE: filter 1D / 1W / 1M / 1Y
// ============================================================
let _chartPeriod = { omset:'1D', cabang:'1D', produk:'1D', payment:'1D' };
let _currentHarianOffset = 0;

// Helper: kembalikan { labels, data } omset sesuai timeframe
function _omsetByPeriod(tf){
  const now = new Date();
  const labels = [], data = [];

  if(tf === '1D'){
    // Per jam hari ini (07:00–sekarang)
    // FIX v116b: sebelumnya menjumlah omsetHistory + penjualanData → setiap transaksi
    // dari pjSave() dihitung 2x karena entry ada di kedua array.
    // Solusi: pakai omsetHistory saja (single source of truth).
    // Fallback ke penjualanData jika omsetHistory belum ada data hari ini (pre-load).
    const today = now.toISOString().slice(0,10);
    const nowH = now.getHours();
    const startH = 7;
    const todayOmset = omsetHistory.filter(o => o.tanggal && o.tanggal.slice(0,10) === today);
    const todayPj    = penjualanData.filter(p => p.tanggal && p.tanggal.slice(0,10) === today);
    const useOmset   = todayOmset.length > 0;
    for(let h = startH; h <= Math.max(nowH, startH); h++){
      labels.push(String(h).padStart(2,'0')+':00');
      let total = 0;
      if(useOmset){
        total = todayOmset.filter(o => {
          const th2 = o.tanggal && o.tanggal.length > 10 ? parseInt(o.tanggal.slice(11,13),10) : nowH;
          return th2 === h;
        }).reduce((s,o) => s + (o.omset||0), 0);
      } else {
        total = todayPj.filter(p => {
          const th2 = p.tanggal && p.tanggal.length > 10 ? parseInt(p.tanggal.slice(11,13),10) : nowH;
          return th2 === h;
        }).reduce((s,p) => s + (p.total||0), 0);
      }
      data.push(Math.round(total/1000));
    }
    return { labels, data, unit:'K' };
  }

  if(tf === '1W'){
    // 7 hari terakhir
    for(let i=6;i>=0;i--){
      const d = new Date(now); d.setDate(now.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      const label = d.toLocaleDateString('id-ID',{weekday:'short'});
      const total = omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,10)===ds).reduce((s,o)=>s+o.omset,0);
      labels.push(label); data.push(Math.round(total/1000000*10)/10);
    }
    return { labels, data, unit:'Jt' };
  }

  if(tf === '1M'){
    // Per hari dalam bulan berjalan
    const year=now.getFullYear(), month=now.getMonth();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const prefix = year+'-'+(month+1<10?'0':'')+(month+1);
    for(let d=1;d<=daysInMonth;d++){
      const ds = prefix+'-'+(d<10?'0':'')+d;
      const total = omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,10)===ds).reduce((s,o)=>s+o.omset,0);
      labels.push(d+''); data.push(Math.round(total/1000000*100)/100);
    }
    return { labels, data, unit:'Jt' };
  }

  if(tf === '1Y'){
    // Per bulan dalam tahun berjalan
    for(let m=0;m<12;m++){
      const d = new Date(now.getFullYear(), m, 1);
      const prefix = now.getFullYear()+'-'+(m+1<10?'0':'')+(m+1);
      const label = d.toLocaleDateString('id-ID',{month:'short'});
      const total = omsetHistory.filter(o=>o.tanggal&&o.tanggal.startsWith(prefix)).reduce((s,o)=>s+o.omset,0);
      labels.push(label); data.push(Math.round(total/1000000*10)/10);
    }
    return { labels, data, unit:'Jt' };
  }

  return { labels:[], data:[], unit:'Jt' };
}

// Helper: filter penjualanData berdasarkan timeframe
function _penjualanByPeriod(tf){
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  if(tf==='1D') return penjualanData.filter(p=>p.tanggal&&p.tanggal.slice(0,10)===today);
  if(tf==='1W'){
    const cutoff = new Date(now); cutoff.setDate(now.getDate()-6);
    const cs = cutoff.toISOString().slice(0,10);
    return penjualanData.filter(p=>p.tanggal&&p.tanggal.slice(0,10)>=cs);
  }
  if(tf==='1M'){
    const prefix = now.getFullYear()+'-'+(now.getMonth()+1<10?'0':'')+(now.getMonth()+1);
    return penjualanData.filter(p=>p.tanggal&&p.tanggal.startsWith(prefix));
  }
  return penjualanData; // 1Y = semua
}

// ── Refresh helpers — dipanggil saat timeframe berubah atau data baru masuk ──
function _refreshOmsetChart(){
  const ch = chartInstances['chart-omset']; if(!ch) return;
  const tf = _chartPeriod.omset;
  const { labels, data, unit } = _omsetByPeriod(tf);
  const hasData = data.some(v=>v>0);
  const alpha = labels.map((_,i,arr)=>{
    const base = 0.45 + (i/(arr.length-1||1))*0.55;
    return `rgba(184,50,50,${base.toFixed(2)})`;
  });
  ch.data.labels = labels;
  ch.data.datasets[0].data = hasData ? data : labels.map(()=>0);
  ch.data.datasets[0].backgroundColor = alpha;
  ch.options.scales.y.ticks.callback = v => v + unit;
  ch.options.plugins.tooltip.callbacks.label = ctx => ctx.raw > 0 ? 'Rp '+ctx.raw+' '+unit : 'Belum ada data';
  const titleMap = {'1D':'Omset Hari Ini (per Jam)','1W':'Omset 7 Hari Terakhir','1M':'Omset Bulan Ini (per Hari)','1Y':'Omset Tahun Ini (per Bulan)'};
  const titleEl = document.getElementById('chart-omset-title');
  if(titleEl){ const first = titleEl.firstChild; if(first&&first.nodeType===3) first.textContent = titleMap[tf]||'Grafik Omset'; }
  ch.update('none');
}

function _refreshCabangChart(){
  const ch = chartInstances['chart-cabang']; if(!ch) return;
  const tf = _chartPeriod.cabang;
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  let subset = omsetHistory;
  if(tf==='1D') subset = omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,10)===today);
  else if(tf==='1W'){ const cut=new Date(now);cut.setDate(now.getDate()-6);const cs=cut.toISOString().slice(0,10);subset=omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,10)>=cs); }
  else if(tf==='1M'){ const pfx=now.getFullYear()+'-'+(now.getMonth()+1<10?'0':'')+(now.getMonth()+1);subset=omsetHistory.filter(o=>o.tanggal&&o.tanggal.startsWith(pfx)); }
  const perCab = {};
  subset.forEach(o=>{ perCab[o.cabang]=(perCab[o.cabang]||0)+o.omset; });
  const entries = Object.entries(perCab).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const palette = ['#B83232','#D4963A','#4E7FC4','#3A9E6E','#C4704E','#7B5FC4'];
  const hasData = entries.length>0;
  ch.data.labels = hasData ? entries.map(([n])=>n.replace('Kampung Dimsum ','KD ')) : ['Belum ada data'];
  ch.data.datasets[0].data = hasData ? entries.map(([,v])=>Math.round(v/1000000*10)/10) : [1];
  ch.data.datasets[0].backgroundColor = hasData ? palette.slice(0,entries.length) : ['rgba(200,200,200,.3)'];
  ch.update('none');
}

function _refreshProdukChart(){
  const ch = chartInstances['chart-produk']; if(!ch) return;
  const tf = _chartPeriod.produk;
  const subset = _penjualanByPeriod(tf);
  const menuCount = {};
  subset.forEach(p=>{(p.items||[]).forEach(item=>{ menuCount[item.name]=(menuCount[item.name]||0)+item.qty; });});
  const top = Object.entries(menuCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const palette = ['#B83232','#D4963A','#4E7FC4','#3A9E6E','#C4704E','#7B5FC4'];
  ch.data.labels = top.length ? top.map(([n])=>n) : ['Belum ada data'];
  ch.data.datasets[0].data = top.length ? top.map(([,v])=>v) : [0];
  ch.data.datasets[0].backgroundColor = palette.slice(0,Math.max(top.length,1));
  ch.update('none');
}

function _refreshPaymentChart(){
  const ch = chartInstances['chart-payment']; if(!ch) return;
  const tf = _chartPeriod.payment;
  const subset = _penjualanByPeriod(tf);
  const payCount = {};
  subset.forEach(p=>{ payCount[p.bayar]=(payCount[p.bayar]||0)+1; });
  const entries = Object.entries(payCount).sort((a,b)=>b[1]-a[1]);
  const palette = ['#B83232','#D4963A','#4E7FC4','#3A9E6E','#C4704E','#7B5FC4'];
  ch.data.labels = entries.length ? entries.map(([n])=>n) : ['QRIS','Tunai','Transfer'];
  ch.data.datasets[0].data = entries.length ? entries.map(([,v])=>v) : [0,0,0];
  ch.data.datasets[0].backgroundColor = palette.slice(0,Math.max(entries.length,1));
  ch.update('none');
}

// ── Period change handlers ──
function changePeriod(btn,tf){
  btn.closest('.chart-period').querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _chartPeriod.omset = tf;
  _refreshOmsetChart();
}
function changeCabangPeriod(btn,tf){
  btn.closest('.chart-period').querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _chartPeriod.cabang = tf;
  _refreshCabangChart();
}
function changeProdukPeriod(btn,tf){
  btn.closest('.chart-period').querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _chartPeriod.produk = tf;
  _refreshProdukChart();
}
function changePaymentPeriod(btn,tf){
  btn.closest('.chart-period').querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _chartPeriod.payment = tf;
  _refreshPaymentChart();
}

// ── CHART HARIAN: omset per hari dalam 1 bulan ──
function initChartHarian(monthOffset){
  const wrap=document.getElementById('chart-harian-wrap');
  if(!wrap)return;
  const th=chartTheme();
  const now=new Date();
  const targetMonth=new Date(now.getFullYear(),now.getMonth()-(monthOffset||0),1);
  const year=targetMonth.getFullYear(),month=targetMonth.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const prefix=year+'-'+(month+1<10?'0':'')+(month+1);
  const dayLabels=[],dayData=[];
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=prefix+'-'+(d<10?'0':'')+d;
    const total=omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,10)===dateStr).reduce((s,o)=>s+o.omset,0);
    dayLabels.push(d+'');dayData.push(Math.round(total/1000000*100)/100);
  }
  const hasData=dayData.some(v=>v>0);
  const ch=chartInstances['chart-harian'];
  if(ch){ch.data.labels=dayLabels;ch.data.datasets[0].data=hasData?dayData:dayLabels.map(()=>0);ch.update();return;}
  const c=document.getElementById('chart-harian');if(!c)return;
  chartInstances['chart-harian']=new Chart(c,{
    type:'bar',
    data:{labels:dayLabels,datasets:[{
      label:'Omset Harian (Juta Rp)',
      data:hasData?dayData:dayLabels.map(()=>0),
      backgroundColor:dayData.map(v=>v>0?'rgba(184,50,50,.75)':'rgba(184,50,50,.2)'),
      borderColor:'transparent',borderWidth:0,
      borderRadius:{topLeft:4,topRight:4},borderSkipped:false
    }]},
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'rgba(26,16,8,.88)',titleColor:'rgba(255,255,255,.9)',bodyColor:'rgba(255,255,255,.7)',borderColor:'rgba(184,50,50,.35)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>(ctx.raw>0?'Rp '+ctx.raw+' Jt':'Belum ada data')}}
      },
      scales:{
        x:{ticks:{color:th.text,font:{size:9,family:'DM Sans'},maxRotation:0},grid:{display:false}},
        y:{ticks:{color:th.text,font:{size:9,family:'DM Sans'},callback:v=>v+'Jt'},grid:{color:th.grid}}
      }
    }
  });
}
function changeHarianPeriod(btn,type){
  btn.closest('.chart-period').querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  initChartHarian(type==='lastmonth'?1:0);
}

// ============ v65: REAL-TIME CHART OMSET HARI INI PER JAM ============
// Update setiap detik (clock), rebuild data setiap 30 detik dari penjualanData + omsetHistory
let _rtChartInterval = null;

function _buildRealtimeData(){
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const nowHour = now.getHours();
  const perJam = new Array(24).fill(0);

  // Helper: parse jam dari string tanggal berbagai format
  function _parseJam(tanggal){
    if(!tanggal) return nowHour;
    const timePart = tanggal.length > 10 ? tanggal.slice(11,13) : '';
    const jam = parseInt(timePart, 10);
    return (!isNaN(jam) && jam >= 0 && jam < 24) ? jam : nowHour;
  }

  // v117 FIX double-count: omsetHistory adalah single source of truth.
  // Jangan pakai keduanya sekaligus — pjSave() push ke KEDUA array.
  const todayOmset = omsetHistory.filter(o => o.tanggal && o.tanggal.slice(0,10) === today);
  const todayPj    = penjualanData.filter(p => p.tanggal && p.tanggal.slice(0,10) === today);
  const useOmset   = todayOmset.length > 0;

  if(useOmset){
    todayOmset.forEach(function(o){ perJam[_parseJam(o.tanggal)] += (o.omset || 0); });
  } else {
    todayPj.forEach(function(p){ perJam[_parseJam(p.tanggal)] += (p.total || 0); });
  }

  // Tampilkan jam buka (07:00) s.d. jam sekarang — selalu minimal 1 bar
  const startHour = 7;
  const endHour = Math.max(nowHour, startHour);
  const labels = [], data = [];
  for(let h = startHour; h <= endHour; h++){
    labels.push(String(h).padStart(2,'0') + ':00');
    data.push(Math.round(perJam[h] / 1000)); // dalam ribu Rp
  }
  return { labels, data };
}

function initRealtimeChart(){
  const wrap = document.getElementById('chart-realtime-wrap');
  if(!wrap) return;
  const c = document.getElementById('chart-realtime');
  if(!c) return;
  // Pastikan wrap visible sebelum Chart.js mencoba render
  if(wrap.style.display === 'none') wrap.style.display = '';
  const th = chartTheme();
  const { labels, data } = _buildRealtimeData();
  // v117 FIX: pakai omsetHistory sebagai single source of truth (sama dengan _buildRealtimeData)
  const today = new Date().toISOString().slice(0,10);
  const todayOmset = omsetHistory.filter(o => o.tanggal && o.tanggal.slice(0,10) === today);
  const totalToday = todayOmset.length > 0
    ? todayOmset.reduce((s,o) => s + (o.omset||0), 0)
    : penjualanData.filter(p => p.tanggal && p.tanggal.slice(0,10) === today).reduce((s,p) => s + (p.total||0), 0);
  const rtTotalEl = document.getElementById('rt-total-val');
  if(rtTotalEl) rtTotalEl.textContent = 'Rp ' + _fmtJuta(totalToday);
  // Warna bar: bar terakhir (jam sekarang) lebih gelap, sisanya transparan
  // Kalau semua 0 → tampilkan bar tipis agar chart tidak blank
  const hasAny = data.some(function(v){ return v > 0; });
  const bgColors = data.map(function(v,i){
    if(i === data.length-1) return 'rgba(184,50,50,.85)';
    return v > 0 ? 'rgba(184,50,50,.45)' : 'rgba(184,50,50,.1)';
  });
  const displayData = hasAny ? data : data.map(function(){ return 0.3; }); // bar dummy agar tidak blank

  // Buat atau update chart
  if(chartInstances['chart-realtime']){
    const ch = chartInstances['chart-realtime'];
    ch.data.labels = labels;
    ch.data.datasets[0].data = displayData;
    ch.data.datasets[0].backgroundColor = bgColors;
    ch.update('none');
    return;
  }
  chartInstances['chart-realtime'] = new Chart(c, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Omset (Ribu Rp)',
        data: displayData,
        backgroundColor: bgColors,
        borderColor: 'transparent', borderWidth: 0,
        borderRadius: { topLeft:4, topRight:4 }, borderSkipped: false
      }]
    },
    options: {
      responsive: true, animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26,16,8,.88)', titleColor: 'rgba(255,255,255,.9)',
          bodyColor: 'rgba(255,255,255,.7)', borderColor: 'rgba(184,50,50,.35)',
          borderWidth: 1, padding: 10, cornerRadius: 8,
          callbacks: { label: function(ctx){ const real = data[ctx.dataIndex]; return real > 0 ? 'Rp ' + (real * 1000).toLocaleString('id-ID') : 'Belum ada transaksi'; } }
        }
      },
      scales: {
        x: { ticks: { color: th.text, font: { size: 9, family: 'DM Sans' }, maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { color: th.text, font: { size: 9, family: 'DM Sans' }, callback: function(v){ return v + 'K'; } }, grid: { color: th.grid } }
      }
    }
  });
}

function _startRealtimeChart(){
  _stopRealtimeChart();
  const wrap = document.getElementById('chart-realtime-wrap');
  if(!wrap) return;
  wrap.style.display = '';
  // Double-rAF + 50ms timeout agar DOM layout & canvas dimensi settle sebelum Chart.js render
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      _loadChartJs(function(){
        setTimeout(function(){ initRealtimeChart(); }, 50);
      });
    });
  });
  // Tick setiap detik: update clock
  _rtChartInterval = setInterval(function(){
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    const clockEl = document.getElementById('rt-clock');
    if(clockEl) clockEl.textContent = hh + ':' + mm + ':' + ss;
    // Rebuild data setiap 30 detik
    if(now.getSeconds() % 5 === 0) initRealtimeChart(); // v70: rebuild setiap 5 detik (lebih responsif)
  }, 1000);
}

function _stopRealtimeChart(){
  if(_rtChartInterval){ clearInterval(_rtChartInterval); _rtChartInterval = null; }
  // Destroy chart instance agar tidak memory leak saat init ulang
  if(chartInstances['chart-realtime']){ chartInstances['chart-realtime'].destroy(); delete chartInstances['chart-realtime']; }
  const wrap = document.getElementById('chart-realtime-wrap');
  if(wrap) wrap.style.display = 'none';
}
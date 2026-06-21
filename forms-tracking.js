// ============ FORMS ============
// CRIT-4 FIX: anti-spam throttle — blokir submit berulang dalam 30 detik
var _franchiseLastSubmit = 0;
var _kontakLastSubmit = 0;

// ════════════════════════════════════════════════════════
// FRANCHISE PAGE TOGGLE — v112
// State disimpan di localStorage (kd_franchise_enabled) dan Supabase
// tabel app_settings {key:'franchise_enabled', value:'true'/'false'}
// ════════════════════════════════════════════════════════
function _applyFranchiseSetting(enabled){
  const soonBox  = document.querySelector('.franchise-soon-box');
  const formWrap = document.getElementById('franchise-form-wrap');
  const btnToggle = document.getElementById('btn-franchise-toggle');
  const statusLabel = document.getElementById('franchise-status-label');
  const bannerText  = document.getElementById('franchise-banner-text');

  if(soonBox)  soonBox.style.display  = enabled ? 'none' : '';
  if(formWrap) formWrap.style.display = enabled ? '' : 'none';

  if(btnToggle){
    if(enabled){
      btnToggle.textContent = 'Nonaktifkan Form';
      btnToggle.style.background = 'var(--bg2)';
      btnToggle.style.color = 'var(--text2)';
      btnToggle.style.border = '1.5px solid var(--border2)';
    } else {
      btnToggle.textContent = 'Aktifkan Form';
      btnToggle.style.background = 'var(--red)';
      btnToggle.style.color = '#fff';
      btnToggle.style.border = 'none';
    }
  }
  if(statusLabel){
    statusLabel.textContent = enabled ? 'Form Aktif' : 'Segera Hadir';
    statusLabel.style.color = enabled ? '#2E7D5E' : 'var(--red)';
  }
  if(bannerText){
    bannerText.innerHTML = enabled
      ? 'Halaman franchise publik saat ini <strong style="color:#2E7D5E">menampilkan formulir pendaftaran mitra</strong>. Klik "Nonaktifkan Form" untuk kembali ke mode Segera Hadir.'
      : 'Halaman franchise publik saat ini menampilkan <strong>Segera Hadir</strong>. Klik "Aktifkan Form" untuk membuka formulir pendaftaran mitra.';
  }
}

async function toggleFranchisePage(){
  const current = localStorage.getItem('kd_franchise_enabled') === 'true';
  const next = !current;
  localStorage.setItem('kd_franchise_enabled', next ? 'true' : 'false');
  _applyFranchiseSetting(next);
  showToast(next ? 'Form franchise berhasil diaktifkan' : 'Form franchise dinonaktifkan — tampil Segera Hadir', 'success');
  // Sync ke Supabase app_settings
  try {
    const sb = getSB(); if(!sb) return;
    await sb.from('app_settings').upsert(
      {key:'franchise_enabled', value: next ? 'true' : 'false', updated_at: new Date().toISOString()},
      {onConflict:'key'}
    );
    _sbLogActivity('Franchise page: ' + (next ? 'diaktifkan' : 'dinonaktifkan'));
  } catch(e){ console.warn('[KD] franchise setting sync error:', e); }
}

async function _loadFranchiseSetting(){
  // Baca dari Supabase dulu, fallback ke localStorage
  try {
    const sb = getSB();
    if(sb){
      const { data, error } = await sb.from('app_settings').select('value').eq('key','franchise_enabled').single();
      if(!error && data){
        const enabled = data.value === 'true';
        localStorage.setItem('kd_franchise_enabled', enabled ? 'true' : 'false');
        _applyFranchiseSetting(enabled);
        return;
      }
    }
  } catch(e){}
  // Fallback localStorage
  const enabled = localStorage.getItem('kd_franchise_enabled') === 'true';
  _applyFranchiseSetting(enabled);
}

function submitFranchise(btnEl){
  // Throttle: 30 detik antar submit
  const now = Date.now();
  if(now - _franchiseLastSubmit < 30000){
    const sisa = Math.ceil((30000 - (now - _franchiseLastSubmit)) / 1000);
    showToast(`Harap tunggu ${sisa} detik sebelum mengirim lagi.`, 'error');
    return;
  }
  const fNama=document.getElementById('f-nama');
  if(!fNama){
    // Form belum tersedia (coming soon) — redirect ke WA
    window.open('https://wa.me/6285133355583?text=Halo,%20saya%20tertarik%20dengan%20program%20kemitraan%20Kampung%20Dimsum','_blank');
    return;
  }
  if(!fNama.value.trim()){showToast('Mohon isi nama lengkap!','error');return;}
  // BUG FIX TC-19: validasi nomor WhatsApp wajib diisi agar tim bisa follow-up
  const fWa = document.getElementById('f-wa');
  if(fWa && !fWa.value.trim()){showToast('Mohon isi nomor WhatsApp!','error');return;}
  if(fWa && fWa.value.trim() && !/^[0-9+\-\s]{8,15}$/.test(fWa.value.trim())){
    showToast('Format nomor WhatsApp tidak valid!','error');return;
  }
  // v89: INSERT ke Supabase franchise_applications
  const fKota=document.getElementById('f-kota');
  const fPesan=document.getElementById('f-pesan');
  const fModal=document.getElementById('f-modal');
  const fModalPaket=document.getElementById('f-modal-paket');
  const appData={
    nama:fNama.value.trim(),
    wa:(fWa?fWa.value.trim():''),
    kota:(fKota?fKota.value.trim():''),
    pesan:(fPesan?fPesan.value.trim():''),
    modal_budget:(fModal?fModal.value:''),
    paket:(fModalPaket?fModalPaket.value:''),
    status:'Baru',
    created_at:new Date().toISOString()
  };
  // FIX v137 KRITIS: pola bug identik dengan submitKontak — toast "berhasil"
  // dan pengosongan form dijalankan SINKRON tanpa menunggu hasil insert.
  // Kalau getSB() null atau insert error, pendaftaran hilang tanpa jejak
  // tapi calon mitra tetap melihat "berhasil dikirim".
  _franchiseLastSubmit = now;
  if(btnEl){ btnEl.disabled = true; btnEl.dataset._origHtml = btnEl.innerHTML; btnEl.innerHTML = 'Mengirim...'; }
  (async function(){
    try {
      await new Promise(function(resolve){ _loadSupabase(resolve); });
      const sb=getSB();
      if(!sb){
        showToast('Gagal mengirim — koneksi ke server belum siap. Coba lagi sebentar.','error');
        _franchiseLastSubmit = 0;
        return;
      }
      const {error}=await sb.from('franchise_applications').insert(appData);
      if(error){
        console.warn('[KD] franchise insert error:',error.message);
        showToast('Gagal mengirim pendaftaran: '+error.message,'error');
        _franchiseLastSubmit = 0;
        return;
      }
      showToast('Permohonan kemitraan berhasil dikirim! Tim kami akan menghubungi dalam 2–3 hari kerja.','success');
      ['f-nama','f-wa','f-kota','f-pesan'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      if(fModal)fModal.value='';
      if(fModalPaket)fModalPaket.value='';
    } catch(e){
      console.warn('[KD] franchise submit exception:', e);
      showToast('Gagal mengirim pendaftaran, silakan coba lagi.','error');
      _franchiseLastSubmit = 0;
    } finally {
      if(btnEl){ btnEl.disabled = false; btnEl.innerHTML = btnEl.dataset._origHtml || 'Kirim Pendaftaran'; }
    }
  })();
}
function submitKontak(btnEl){
  // Throttle: 30 detik antar submit
  const now = Date.now();
  if(now - _kontakLastSubmit < 30000){
    const sisa = Math.ceil((30000 - (now - _kontakLastSubmit)) / 1000);
    showToast(`Harap tunggu ${sisa} detik sebelum mengirim lagi.`, 'error');
    return;
  }
  const kNama=document.getElementById('k-nama');
  if(!kNama||!kNama.value.trim()){showToast('Mohon isi nama Anda!','error');return;}
  // ✅ BUG FIX #6 (MEDIUM) — QA: tidak ada validasi format email, user bisa submit email kosong/invalid
  // JANGAN hapus validasi ini — tanpa ini form bisa dikirim tanpa email yang bisa dihubungi
  const kEmail=document.getElementById('k-email');
  if(!kEmail||!kEmail.value.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kEmail.value.trim())){
    showToast('Mohon isi email yang valid!','error');return;
  }
  const kPesan=document.getElementById('k-pesan');
  if(!kPesan||!kPesan.value.trim()){showToast('Mohon isi pesan Anda!','error');return;}
  // FIX v137 KRITIS: sebelumnya toast "berhasil dikirim" + pengosongan form
  // dijalankan SINKRON tanpa menunggu hasil insert ke Supabase, dan kalau
  // getSB() null (Supabase JS belum sempat load), insert tidak dicoba SAMA
  // SEKALI — pesan pelanggan hilang total tanpa jejak, tapi pelanggan tetap
  // melihat "berhasil". Ini akar masalah kenapa feedback publik tidak pernah
  // muncul di panel admin. Sekarang: tombol di-nonaktifkan sementara, insert
  // di-await, dan form HANYA dikosongkan + toast sukses HANYA jika insert
  // benar-benar berhasil. Jika gagal, pesan tetap di form agar tidak hilang.
  const kSubj=document.getElementById('k-subjek');
  if(btnEl){ btnEl.disabled = true; btnEl.dataset._origHtml = btnEl.innerHTML; btnEl.innerHTML = 'Mengirim...'; }
  _kontakLastSubmit = now;
  (async function(){
    try {
      // FIX v137: pastikan Supabase JS sudah ter-load sebelum getSB() dipanggil —
      // sebelumnya getSB() bisa return null kalau dipanggil terlalu cepat.
      await new Promise(function(resolve){ _loadSupabase(resolve); });
      const sb = getSB();
      if(!sb){
        showToast('Gagal mengirim — koneksi ke server belum siap. Coba lagi sebentar.','error');
        _kontakLastSubmit = 0; // reset throttle agar bisa langsung coba lagi
        return;
      }
      const {error} = await sb.from('feedback').insert({
        nama: kNama.value.trim(),
        email: kEmail.value.trim(),
        subjek: (kSubj?kSubj.value.trim():'Kontak'),
        pesan: kPesan.value.trim(),
        created_at: new Date().toISOString()
      });
      if(error){
        console.warn('[KD] feedback insert error:', error.message);
        showToast('Gagal mengirim pesan: '+error.message,'error');
        _kontakLastSubmit = 0; // reset throttle agar bisa langsung coba lagi
        return;
      }
      showToast('Pesan berhasil dikirim! Kami akan membalas dalam 1×24 jam.','success');
      ['k-nama','k-email','k-pesan'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    } catch(e){
      console.warn('[KD] feedback submit exception:', e);
      showToast('Gagal mengirim pesan, silakan coba lagi.','error');
      _kontakLastSubmit = 0;
    } finally {
      if(btnEl){ btnEl.disabled = false; btnEl.innerHTML = btnEl.dataset._origHtml || 'Kirim Pesan'; }
    }
  })();
}

// ============ SHARE SHEET ============
let shareContent='';
function openShareSheet(content){
  shareContent=content;
  document.getElementById('share-sheet-title').textContent='Bagikan: '+(content.length>40?content.substring(0,40)+'...':content);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.getElementById('share-sheet').classList.add('show');
    document.getElementById('share-overlay').classList.add('show');
  }); });
}
function closeShareSheet(){
  document.getElementById('share-sheet').classList.remove('show');
  document.getElementById('share-overlay').classList.remove('show');
}
function doShare(platform){
  const text=encodeURIComponent(shareContent+' — Kunjungi kampungdimsum.com');
  if(platform==='whatsapp'){window.open('https://wa.me/?text='+text,'_blank');}
  else if(platform==='copy'){navigator.clipboard.writeText(shareContent+' — Kunjungi kampungdimsum.com').then(function(){showToast('Link berhasil disalin!','success');}).catch(function(){showToast('Gagal menyalin — coba manual','error');});}
  else if(platform==='instagram'){showToast('Buka Instagram dan bagikan ke Stories!','info');}
  else if(platform==='tiktok'){showToast('Buka TikTok dan bagikan!','info');}
  closeShareSheet();
}
function shareToSosmed(platform){openShareSheet('Kampung Dimsum — Dimsum Autentik Terbaik di Jabodetabek!');}

// ============ ORDER TRACKING ============
function showTrackingModal(){
  document.getElementById('tracking-result').innerHTML='';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.getElementById('tracking-modal').classList.add('show');
  }); });
}
function closeTrackingModal(e){if(e.target===document.getElementById('tracking-modal'))closeTrackingModalBtn();}
function closeTrackingModalBtn(){document.getElementById('tracking-modal').classList.remove('show');}
function doTracking(){
  const num=document.getElementById('order-num-input').value.trim();
  // BUG FIX TC-26: validasi input kosong sebelum mencari pesanan
  if(!num){ showToast('Masukkan nomor pesanan terlebih dahulu!','error'); return; }
  const order=ordersData.find(o=>o.id===num);
  if(!order){document.getElementById('tracking-result').innerHTML=`<div style="text-align:center;padding:20px;color:var(--text3);font-size:.85rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="M15 9l-6 6M9 9l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg> Nomor pesanan tidak ditemukan. Coba: KD-241202-003</div>`;return;}
  const diterima = true;
  const diproses = order.status==='Diproses'||order.status==='Siap Diambil'||order.status==='Selesai';
  const siapDiambil = order.status==='Siap Diambil'||order.status==='Selesai';
  const steps=[
    {label:'Pesanan Diterima',sub:'Pesanan masuk ke sistem',done:diterima,active:order.status==='Pending',time:''},
    {label:'Sedang Diproses',sub:'Tim sedang menyiapkan pesanan',done:diproses,active:order.status==='Diproses',time:diproses?order.waktu:''},
    {label:'Siap Diambil',sub:'Pesanan siap di counter',done:siapDiambil,active:order.status==='Siap Diambil',time:siapDiambil?order.waktu:''},
  ];
  document.getElementById('tracking-result').innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:14px 16px;margin-bottom:16px;font-size:.82rem">
      <div style="font-weight:700;color:var(--text);margin-bottom:4px">${_esc(order.id)}</div>
      <div style="color:var(--text3)">${_esc(order.items)}</div>
      <div style="color:var(--red);font-weight:600;margin-top:4px">${_esc(order.total)} · ${_esc(order.cabang)}</div>
    </div>
    <div class="track-steps">
      ${steps.map(s=>`<div class="track-step ${s.done?'done':''} ${s.active&&!s.done?'active':''}">
        <div class="track-dot">${s.done?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><path d="M5 12l5 5L19 7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':'○'}</div>
        <div class="track-info">
          <h4>${s.label}</h4>
          <p>${s.sub}</p>
          ${s.time?`<div class="track-time"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="13" r="8" fill="none" stroke="var(--text2)" stroke-width="1.8"/><path d="M12 9v4l3 2" stroke="var(--red)" stroke-width="2" stroke-linecap="round"/><path d="M5 4l2 2M19 4l-2 2" stroke="var(--text3)" stroke-width="2" stroke-linecap="round"/></svg> ${s.time} WIB</div>`:''}
        </div>
      </div>`).join('')}
    </div>`;
}

// ============ ADMIN TABLES ============
function renderAdminTables(){
  // BUG-C3 FIX: tbl-performa TIDAK lagi di-render di sini dengan data dummy
  // Rendering tbl-performa dilakukan oleh renderDashboardForRole() dengan data real omsetHistory
  // Memanggil renderDashboardForRole() di akhir fungsi ini agar tetap sinkron setelah CRUD
  renderOmsetTable();
  // Menu dengan Stock Control
  const tM=document.getElementById('tbl-menu-mgmt');
  if(tM)tM.innerHTML=`<thead><tr><th class="th-center">#</th><th>Nama</th><th class="th-center">Kategori</th><th class="th-right">Harga</th><th class="th-center">Stok</th><th class="th-center">Aksi</th></tr></thead><tbody>${menuData.map((m,idx)=>`<tr><td data-label='#' class="td-center" style="color:var(--text4)">${m.id}</td><td data-label='Nama' style="font-weight:500;color:var(--text)">${_esc(m.name)}</td><td data-label='Kategori'><span class="td-badge badge-normal">${_esc(m.cat)}</span></td><td data-label='Harga' class="td-num" style="color:var(--red);font-weight:600">Rp ${m.price.toLocaleString('id-ID')}</td><td data-label='Stok'><div class="stock-toggle"><label class="stock-switch"><input type="checkbox" ${m.inStock?'checked':''} onchange="toggleStock(${idx},this.checked)"><span class="stock-slider"></span></label><span class="stock-label" id="stock-lbl-${idx}">${m.inStock?'Tersedia':'Habis'}</span></div></td><td><div style="display:flex;gap:7px"><button class="btn-edit" onclick="editMenu(${idx})">Edit</button><button class="btn-danger" onclick="hapusMenu(${idx})">Hapus</button></div></td></tr>`).join('')}</tbody>`;
  const tC=document.getElementById('tbl-cabang-mgmt');
  if(tC)tC.innerHTML=`<thead><tr><th>Cabang</th><th>Alamat</th><th>Jam Buka</th><th class="th-center">Rating</th><th class="th-center">Status</th><th class="th-center">Aksi</th></tr></thead><tbody>${cabangData.map((c,idx)=>`<tr><td data-label='Cabang' style="font-weight:600;color:var(--text)">${_esc(c.name)}</td><td data-label='Alamat' style="font-size:.78rem">${_esc(c.addr)}</td><td data-label='Jam'>${_esc(c.jam)}</td><td><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="var(--gold)" stroke="var(--gold)" stroke-width="1"/></svg> ${c.rating}</td><td><span class="td-badge ${c.open?'badge-open':'badge-closed'}">${c.open?'Buka':'Tutup'}</span></td><td><div style="display:flex;gap:7px"><button class="btn-edit" onclick="editCabang(${idx})">Edit</button><button class="btn-danger" onclick="hapusCabang(${idx})">Hapus</button></div></td></tr>`).join('')}</tbody>`;
  const tPr=document.getElementById('tbl-promo-mgmt');
  // ✅ BUG FIX #1 (CRITICAL) — QA: tbl-promo-mgmt tombol Edit/Hapus tidak ada onclick handler
  // JANGAN hapus idx dari onclick — dibutuhkan untuk editPromo/hapusPromo tahu baris mana
  if(tPr)tPr.innerHTML=`<thead><tr><th>Tag</th><th>Judul</th><th>Deskripsi</th><th class="th-center">Kadaluarsa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${promoData.map((p,idx)=>`<tr style="${p.active===false?'opacity:.55':''}"><td><span class="td-badge badge-best">${_esc(p.tag)}</span></td><td style="font-weight:500;color:var(--text)">${_esc(p.title)}</td><td style="font-size:.76rem;color:var(--text3)">${_esc((p.desc||'').substring(0,50))}...</td><td style="font-size:.76rem">${_esc(p.expire)}</td><td><div class="stock-toggle"><label class="stock-switch"><input type="checkbox" ${p.active!==false?'checked':''} onchange="togglePromoActive(${idx})"><span class="stock-slider"></span></label><span class="stock-label" style="font-size:.72rem">${p.active!==false?'Aktif':'Nonaktif'}</span></div></td><td><div style="display:flex;gap:7px"><button class="btn-edit" onclick="editPromo(${idx})">Edit</button><button class="btn-danger" onclick="hapusPromo(${idx})">Hapus</button></div></td></tr>`).join('')}</tbody>`;
  const tF=document.getElementById('tbl-franchise');
  // BUG-C4 FIX: tombol Proses & Tolak kini punya onclick handler
  const _frData = window._franchiseApplicants || franchiseApplicants || [];
  if(tF)tF.innerHTML=`<thead><tr><th>Nama</th><th>WhatsApp</th><th>Kota</th><th class="th-right">Modal</th><th class="th-center">Status</th><th>Aksi</th></tr></thead><tbody>${_frData.map((f,idx)=>`<tr><td style="font-weight:500;color:var(--text)">${_esc(f.nama)}</td><td>${_esc(f.wa||f.whatsapp||'—')}</td><td>${_esc(f.kota||'—')}</td><td class="td-num">${_esc(f.modal_budget||f.modal||'—')}</td><td><span class="td-badge ${f.status==='Diproses'?'badge-open':f.status==='Ditolak'?'badge-closed':'badge-normal'}">${_esc(f.status)}</span></td><td><div style="display:flex;gap:7px">${f.status!=='Diproses'?`<button class="btn-edit" onclick="prosesApplicant(${idx})">Proses</button>`:'<span style="font-size:.75rem;color:var(--text4)">Sedang diproses</span>'}<button class="btn-danger" onclick="tolakApplicant(${idx})">Tolak</button></div></td></tr>`).join('')}</tbody>`;
  const tFb=document.getElementById('tbl-feedback');
  const _fbData = window._feedbackList || feedbackList || [];
  if(tFb){
    if(!_fbData.length){
      tFb.innerHTML='<tbody><tr class="tbl-empty"><td colspan="5">Belum ada feedback masuk</td></tr></tbody>';
    } else {
      tFb.innerHTML=`<thead><tr><th>Nama</th><th>Email / Subjek</th><th class="th-center">Rating</th><th>Pesan</th><th>Tanggal</th></tr></thead><tbody>${_fbData.map(f=>{
        // Support both: kontak form (email+subjek, no rating/cabang) and future feedback form
        const emailOrSubjek = f.email ? (f.email + (f.subjek&&f.subjek!=='Kontak'?' · '+f.subjek:'')) : (f.subjek||f.cabang||'—');
        const starCount = Math.min(Math.max(parseInt(f.rating)||0, 0), 5);
        const starStr = starCount > 0
          ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="var(--gold)" stroke="var(--gold)" stroke-width="1"/></svg>'.repeat(starCount) + ' <span style="font-size:.72rem;color:var(--text3)">('+starCount+')</span>'
          : '<span style="color:var(--text4);font-size:.72rem">—</span>';
        return `<tr>
          <td style="font-weight:500;color:var(--text)">${_esc(f.nama)}</td>
          <td style="font-size:.76rem;color:var(--text3)">${_esc(emailOrSubjek)}</td>
          <td style="color:#F59E0B;text-align:center">${starStr}</td>
          <td style="font-size:.78rem;color:var(--text2)">${_esc(f.pesan)}</td>
          <td style="font-size:.76rem;color:var(--text3)">${_esc(f.tanggal)}</td>
        </tr>`;
      }).join('')}</tbody>`;
    }
  }
  renderOrderTable();
  // BUG-C3 FIX: refresh tbl-performa dengan data real setelah setiap CRUD
  renderDashboardForRole();
  // BUG FIX: panel user-mgmt load live dari Supabase saat renderAdminTables
  // loadAdminUsers() akan dipanggil oleh switchPanel('user-mgmt') untuk fresh data
  if(adminUsers.length > 0) renderUserMgmt(); // render cache jika sudah ada
}

function toggleStock(idx,val){
  menuData[idx].inStock=val;
  const lbl=document.getElementById('stock-lbl-'+idx);
  if(lbl)lbl.textContent=val?'Tersedia':'Habis';
  // BUG FIX v56: sync perubahan inStock ke Supabase menu_items
  _katalogSyncToSupabase(menuData[idx]);
  pmRender(window._pmCurrentFilter||pmCurrentFilter||'all', document.getElementById('pm-search')?.value||'');
  showToast(`${menuData[idx].name} → ${val?'Tersedia <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#10B981"/><path d="M8 12l3 3 5-6" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':'Stok Habis <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="M15 9l-6 6M9 9l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'}`,val?'success':'error');
}

// FIX v129 MEDIUM-01: hapus penjualan by order_id (stabil), bukan positional idx
function showDeletePenjualanById(orderId, label){
  if(currentUserRole !== 'superadmin'){ showToast('Akses ditolak','error'); return; }
  const realIdx = penjualanData.findIndex(p => p.id === orderId || p.order_id === orderId);
  if(realIdx === -1){ showToast('Transaksi tidak ditemukan, refresh halaman','error'); return; }
  showDeleteConfirmSA('penjualan', realIdx, label);
}

// FIX v129 MEDIUM-01: hapus omset by key (order_id/idempotency_key), bukan positional idx
// Mencegah hapus record salah jika array berubah setelah render (realtime update)
function showDeleteOmsetByKey(key, label){
  if(currentUserRole !== 'superadmin'){ showToast('Akses ditolak','error'); return; }
  // Cari idx real berdasarkan key
  const realIdx = omsetHistory.findIndex(o => (o.order_id && o.order_id === key) || (o.idempotency_key && o.idempotency_key === key) || String(omsetHistory.indexOf(o)) === key);
  if(realIdx === -1){ showToast('Data tidak ditemukan, refresh halaman','error'); return; }
  showDeleteConfirmSA('omset', realIdx, label);
}

function renderOmsetTable(){
  const tbl=document.getElementById('tbl-omset');
  if(!tbl)return;
  const isSA = currentUserRole === 'superadmin';
  const hdDel = isSA ? '<th style="width:70px">Hapus</th>' : '';
  // FIX v129 MEDIUM-01: hapus pakai order_id (stabil) bukan positional idx (bisa stale setelah realtime update)
  tbl.innerHTML=`<thead><tr><th>Tanggal</th><th>Cabang</th><th class="th-right">Total Omset</th><th class="th-center">Transaksi</th><th class="th-right">Avg/Trx</th>${hdDel}</tr></thead><tbody>${omsetHistory.map((o,idx)=>{const delKey=_escJsAttr(o.order_id||o.idempotency_key||String(idx));const delLabel=_escJsAttr(o.tanggal+' \u00b7 '+o.cabang+' \u00b7 Rp '+parseInt(o.omset).toLocaleString('id-ID'));return`<tr><td style="color:var(--text3)">${_esc(o.tanggal)}</td><td style="font-weight:500;color:var(--text)">${_esc(o.cabang)}</td><td class="td-num" style="color:var(--red);font-weight:600">Rp ${parseInt(o.omset).toLocaleString('id-ID')}</td><td class="td-center">${o.trx}</td><td class="td-num">Rp ${o.trx>0?Math.round(o.omset/o.trx).toLocaleString('id-ID'):'—'}</td>${isSA?`<td><button class="btn-sa-del" onclick="showDeleteOmsetByKey('${delKey}','${delLabel}')">Hapus</button></td>`:''}</tr>`;}).join('')}</tbody>`;
}
// ============ BRANCH PICKER ============
// branchOptions: di-generate dari cabangData agar selalu sinkron (termasuk setelah load Supabase)
function getBranchOptions(){ return cabangData.filter(c=>c.type==='cabang'||c.type==='agen').map(c=>c.name); }
let branchOptions = getBranchOptions();
const branchEmoji={'03':'03','07':'07','08':'08','09':'09','12':'12','15':'15'};
let selectedBranch='';
function openBranchPicker(){
  // v58 FIX: block branch picker untuk non-superadmin yang sudah dikunci ke cabangnya
  const isSA = currentUserRole === 'superadmin';
  const profile = window._currentAdmin;
  const myCabang = profile ? (profile.cabang_name || profile.cabang || '') : '';
  if(!isSA && myCabang) return; // cabang sudah dikunci, jangan buka modal

  const overlay=document.getElementById('branch-modal-overlay');
  overlay.classList.add('open');
  document.getElementById('branch-search-input').value='';
  renderBranchList('');
  setTimeout(()=>document.getElementById('branch-search-input').focus(),400);
  document.body.style.overflow='hidden';
  document.getElementById('branch-picker-trigger').classList.add('open');
}
function closeBranchPicker(){
  const overlay=document.getElementById('branch-modal-overlay');
  overlay.classList.remove('open');
  document.body.style.overflow='';
  document.getElementById('branch-picker-trigger').classList.remove('open');
}
function closeBranchPickerOutside(e){
  if(e.target===document.getElementById('branch-modal-overlay'))closeBranchPicker();
}
function filterBranchList(q){renderBranchList(q);}
function renderBranchList(q){
  branchOptions = getBranchOptions();
  const list=document.getElementById('branch-list');
  const filtered=branchOptions.filter(b=>b.toLowerCase().includes(q.toLowerCase()));
  if(!filtered.length){list.innerHTML=`<div class="branch-empty">Tidak ada cabang ditemukan</div>`;return;}
  list.innerHTML=filtered.map(b=>{
    const num=b.replace('Kampung Dimsum ','');
    const sel=b===selectedBranch;
    // FIX BUG-L4: escape tanda kutip tunggal di nama cabang agar tidak break onclick handler
    const bEscaped = b.replace(/'/g, "\\'");
    return `<div class="branch-item${sel?' selected':''}" onclick="selectBranch('${bEscaped}')">
      <div class="branch-item-left">
        <div class="branch-item-dot"><img src="gambar/logo.png" alt="KD" style="width:26px;height:26px;border-radius:50%;object-fit:cover"></div>
        <div>
          <div class="branch-item-name">${b}</div>
          <div class="branch-item-sub">Cabang No. ${num}</div>
        </div>
      </div>
      <div class="branch-item-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg>
      </div>
    </div>`;
  }).join('');
}
function selectBranch(name){
  selectedBranch=name;
  document.getElementById('o-cabang').value=name;
  const trigger=document.getElementById('branch-picker-trigger');
  document.getElementById('branch-picker-text').textContent=name;
  trigger.classList.add('has-value');
  const num=name.replace('Kampung Dimsum ','');
  trigger.querySelector('.branch-picker-icon').innerHTML=`<img src="gambar/logo.png" alt="KD" style="width:20px;height:20px;border-radius:50%;object-fit:cover">`;
  // Animate checkmark then close
  renderBranchList(document.getElementById('branch-search-input').value);
  setTimeout(()=>closeBranchPicker(),320);
}


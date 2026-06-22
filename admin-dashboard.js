// ============ USER MANAGEMENT — FULL FEATURED ============
// ✅ UX FIX — currentUserRole tidak lagi hardcoded 'superadmin'
// Diambil dari _currentAdmin.role saat render, fallback 'staff' agar aman
// JANGAN hardcode 'superadmin' di sini — berbahaya di produksi (semua user dapat akses superadmin)
let currentUserRole = 'staff'; // default aman; akan diupdate oleh _applyAdminProfile
let umDeleteTarget = -1;
let umChPwdTarget = -1; // -1 = self

const permLabels = {dashboard:'Dashboard',penjualan:'Penjualan',menu:'Menu',stok:'Stok',bahan_baku:'Bahan Baku',laporan_produksi:'Laporan Produksi',omset:'Omset',analitik:'Analitik',feedback:'Feedback',franchise:'Franchise',user:'User Mgmt'};
const permIcons  = {dashboard:'dashboard',menu:'menu',stok:'stok',omset:'omset',analitik:'analitik',user:'user'};

// v87: _mergePerms — single source of truth untuk default permissions
// Prinsip: nilai dari DB SELALU menang. Key yang tidak ada di DB:
//   superadmin → true (owner punya semua akses)
//   non-superadmin → FALSE (aman, harus di-grant eksplisit oleh superadmin)
function _mergePerms(rawPerms, role){
  const isSA = (role === 'superadmin');
  const safeRaw = (rawPerms && typeof rawPerms === 'object') ? rawPerms : {};
  const allKeys = ['dashboard','penjualan','menu','stok','bahan_baku','laporan_produksi','analitik','user','omset','feedback','franchise'];
  const merged = {};
  allKeys.forEach(function(k){
    if(safeRaw[k] !== undefined){
      merged[k] = safeRaw[k] === true; // pastikan boolean
    } else {
      merged[k] = isSA; // superadmin: true, lain: false
    }
  });
  return merged;
}

function getAvatarClass(role){ return role==='superadmin'?'avatar-superadmin':role==='admin'?'avatar-admin':'avatar-staff'; }
function getRoleCardClass(role){ return 'role-card-'+role; }

function renderUserMgmt(){
  // v85 FIX: pakai permission check, bukan hardcode superadmin
  const hasUserPerm = (currentUserRole === 'superadmin') || (window._currentPerms && window._currentPerms.user === true);
  if(!hasUserPerm){
    const overlay = document.getElementById('um-lock-overlay');
    if(overlay) requestAnimationFrame(function(){ requestAnimationFrame(function(){
      overlay.classList.add('show');
    }); });
    return;
  }
  // Pastikan lock overlay tersembunyi jika punya akses
  const overlay = document.getElementById('um-lock-overlay');
  if(overlay) overlay.classList.remove('show');

  // Render stats
  const statsEl = document.getElementById('um-stats-row');
  if(statsEl){
    const sa = adminUsers.filter(u=>u.role==='superadmin').length;
    const ad = adminUsers.filter(u=>u.role==='admin').length;
    const st = adminUsers.filter(u=>u.role==='staff').length;
    statsEl.innerHTML = `
      <div class="um-stat-card um-stat-sa">
        <div class="um-stat-val">${sa}</div>
        <div class="um-stat-label">Super Admin</div>
      </div>
      <div class="um-stat-card um-stat-ad">
        <div class="um-stat-val">${ad}</div>
        <div class="um-stat-label">Admin Cabang</div>
      </div>
      <div class="um-stat-card um-stat-st">
        <div class="um-stat-val">${st}</div>
        <div class="um-stat-label">Staff</div>
      </div>`;
  }

  // Render user cards
  const grid = document.getElementById('user-roles-grid');
  if(grid) grid.innerHTML = adminUsers.map((u,idx)=>`
    <div class="user-role-card ${getRoleCardClass(u.role)}">
      <div class="user-role-header">
        <div class="user-role-avatar ${getAvatarClass(u.role)}">${u.initial}</div>
        <div class="user-role-info">
          <div class="user-role-name">${_esc(u.name)}</div>
          <div class="user-role-username">@${_esc(u.username)}</div>
          <span class="user-role-badge role-${u.role}">${u.role==='superadmin'?'SUPER ADMIN':u.role==='admin'?'ADMIN':'STAFF'}</span>
        </div>
      </div>
      <div class="user-role-meta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="currentColor" opacity=".2"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></svg>
        ${_esc(u.cabang)}
      </div>
      <div class="user-role-perms">
        ${Object.entries(u.perms).map(([k,v])=>`
          <div class="perm-item">
            <span>${permLabels[k]||k}</span>
            <span class="${v?'perm-check':'perm-cross'}">${v
              ?'<svg viewBox="0 0 24 24" fill="none" stroke="#3A9E6E" stroke-width="3" width="13" height="13"><path d="M5 12l5 5L19 7"/></svg>'
              :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            }</span>
          </div>`).join('')}
      </div>
      <div class="user-role-actions" style="margin-top:12px">
        <button class="btn-user-edit" onclick="umOpenEdit(${idx})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="margin-right:4px;vertical-align:middle"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Akses
        </button>
        <button class="btn-user-edit" onclick="umChangePasswordFor(${idx})" title="Ubah Password" style="flex:0;padding:7px 10px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </button>
        <button class="btn-user-del user-role-card-${idx}" onclick="umOpenDelete(${idx})" title="Hapus Akun">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`).join('');

  // Activity log table
  const tA = document.getElementById('tbl-activity');
  if(tA) tA.innerHTML=`<thead><tr><th>User</th><th>Aksi</th><th class="th-center">Waktu</th></tr></thead><tbody>${(activityLog||[]).map(a=>`
    <tr>
      <td style="font-weight:600;color:var(--text)">${_esc(a.user)}</td>
      <td style="font-size:.78rem;color:var(--text2)">${_esc(a.aksi)}</td>
      <td style="font-size:.76rem;color:var(--text3)">${_esc(a.waktu)}</td>
    </tr>`).join('')}</tbody>`;
}

// --- UM MODAL: HELPER — populate cabang select dari DB live ---
// FIX v91: fetch ALL cabang dari DB (cabang + agen + produksi), sort by id numerik.
// Tidak filter type di sini — semua unit valid untuk ditugaskan ke admin.
async function _umPopulateCabangSelect(afterFn){
  const sb = getSB();
  let dbRows = null;
  if(sb){
    try {
      const { data: cRows, error: cErr } = await sb
        .from('cabang')
        .select('id,name,type')
        .order('id', {ascending: true});
      if(!cErr && cRows && cRows.length){
        dbRows = cRows;
        // Merge ke cabangData (agar konsisten dg peta dll)
        cRows.forEach(function(r){
          const exists = cabangData.find(c=>String(c.id)===String(r.id)||c.name===r.name);
          if(!exists) cabangData.push({id:r.id,name:r.name,addr:'',jam:'08.00-21.00',rating:5,wa:'',open:true,lat:0,lng:0,mapsUrl:'',type:r.type||'cabang'});
          else { exists.name=r.name; exists.type=r.type||exists.type; }
        });
      }
    } catch(e){ /* gunakan cabangData yang sudah ada */ }
  }

  // Sumber data: prioritaskan hasil DB, fallback ke cabangData
  // Sertakan semua type kecuali 'produksi' — produksi tidak punya admin cabang
  const sourceRows = dbRows
    ? dbRows.filter(r => r.type !== 'produksi')
    : cabangData.filter(c => c.type !== 'produksi');

  // Sort by nomor — ambil angka di akhir nama, fallback sort alphabetical
  sourceRows.sort(function(a, b){
    const na = parseInt((a.name||'').replace(/\D/g,'').slice(-3)) || 9999;
    const nb = parseInt((b.name||'').replace(/\D/g,'').slice(-3)) || 9999;
    return na - nb;
  });

  const selCab = document.getElementById('um-cabang');
  if(selCab){
    selCab.innerHTML = '<option value="Semua Cabang">Semua Cabang</option>'
      + sourceRows.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')
      + '<option value="__baru__">+ Cabang Baru...</option>';
  }
  if(afterFn) afterFn();
}

// --- UM MODAL: ADD ---
function umOpenAdd(){
  document.getElementById('um-edit-idx').value = '-1';
  document.getElementById('um-modal-title').textContent = 'Tambah Admin Baru';
  document.getElementById('um-modal-subtitle').textContent = 'Isi data akun dan tentukan hak akses';
  document.getElementById('um-save-label').textContent = 'Simpan Admin';
  document.getElementById('um-nama').value = '';
  document.getElementById('um-username').value = '';
  document.getElementById('um-role').value = 'admin';
  const baruInput = document.getElementById('um-cabang-baru');
  if(baruInput){ baruInput.value=''; baruInput.style.display='none'; }
  const baruHint = document.getElementById('um-cabang-baru-hint');
  if(baruHint) baruHint.style.display='none';
  document.getElementById('um-password').value = '';
  document.getElementById('pwd-bar').style.width = '0';
  document.getElementById('um-pwd-label').innerHTML = 'Password <span class="required">*</span>';
  document.getElementById('um-pwd-group').style.display = 'block';
  // FIX v90: load cabang dari DB dulu, lalu buka modal
  _umPopulateCabangSelect(function(){
    const selCab = document.getElementById('um-cabang');
    if(selCab && selCab.querySelector('option[value="KD 09"]')) selCab.value = 'KD 09';
    else if(selCab && selCab.options.length > 1) selCab.selectedIndex = 1;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      // FIX v91: sembunyikan nav pill agar tidak menutupi form di mobile
      document.body.classList.add('modal-nav-hidden');
      document.getElementById('um-modal-overlay').classList.add('show');
      umOnRoleChange();
      umRenderPerms({dashboard:true,menu:true,stok:true,bahan_baku:false,omset:false,analitik:false,user:false});
    }); });
  });
}

// --- UM MODAL: EDIT ---
function umOpenEdit(idx){
  const u = adminUsers[idx];
  document.getElementById('um-edit-idx').value = idx;
  document.getElementById('um-modal-title').textContent = 'Edit Akun Admin';
  document.getElementById('um-modal-subtitle').textContent = `Mengedit: ${u.name}`;
  document.getElementById('um-save-label').textContent = 'Simpan Perubahan';
  document.getElementById('um-nama').value = u.name;
  document.getElementById('um-username').value = u.username;
  document.getElementById('um-role').value = u.role;
  document.getElementById('um-password').value = '';
  document.getElementById('pwd-bar').style.width = '0';
  document.getElementById('um-pwd-label').innerHTML = 'Password Baru <small style="color:var(--text4)">(kosongkan jika tidak diubah)</small>';
  document.getElementById('um-pwd-group').style.display = 'block';
  // FIX v90: load cabang dari DB dulu, set value ke cabang user yang diedit
  const _umEditPerms = u.perms;
  const _uCabang = u.cabang;
  _umPopulateCabangSelect(function(){
    const selCab = document.getElementById('um-cabang');
    if(selCab){ selCab.value = _uCabang; }
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      // FIX v91: sembunyikan nav pill agar tidak menutupi form di mobile
      document.body.classList.add('modal-nav-hidden');
      document.getElementById('um-modal-overlay').classList.add('show');
      umOnRoleChange();
      umRenderPerms(_umEditPerms);
    }); });
  });
}
function umCloseModal(){
  document.getElementById('um-modal-overlay').classList.remove('show');
  // FIX v91: tampilkan kembali nav pill setelah modal ditutup
  document.body.classList.remove('modal-nav-hidden');
}

function umOnCabangChange(){
  const sel = document.getElementById('um-cabang');
  const baruInput = document.getElementById('um-cabang-baru');
  const baruHint = document.getElementById('um-cabang-baru-hint');
  if(!sel || !baruInput) return;
  if(sel.value === '__baru__'){
    baruInput.style.display = 'block';
    if(baruHint) baruHint.style.display = 'block';
    baruInput.focus();
  } else {
    baruInput.style.display = 'none';
    if(baruHint) baruHint.style.display = 'none';
  }
}

function umValidateCabangBaru(){
  // Validasi ringan — hanya memastikan ada isi
}

function umOnRoleChange(){
  const role = document.getElementById('um-role').value;
  const cabangSel = document.getElementById('um-cabang');
  if(role === 'superadmin'){
    cabangSel.value = 'Semua Cabang';
    cabangSel.disabled = true;
    // Auto-check all perms
    umRenderPerms({dashboard:true,penjualan:true,menu:true,stok:true,bahan_baku:true,laporan_produksi:true,omset:true,analitik:true,feedback:true,franchise:true,user:true});
  } else {
    cabangSel.disabled = false;
    if(cabangSel.value === 'Semua Cabang') cabangSel.value = 'KD 09';
  }
}

function umRenderPerms(perms){
  document.getElementById('um-perms-grid').innerHTML = Object.keys(permLabels).map(k=>`
    <div class="um-perm-toggle ${perms[k]?'active':''}" id="pt-${k}" onclick="umTogglePerm('${k}')">
      <span class="perm-toggle-name">${permLabels[k]}</span>
      <div class="perm-toggle-dot"></div>
    </div>`).join('');
}

function umTogglePerm(key){
  const el = document.getElementById('pt-'+key);
  // User perm only for superadmin
  if(key==='user' && document.getElementById('um-role').value !== 'superadmin'){
    showToast('Hak akses "User Mgmt" hanya untuk Super Admin','error'); return;
  }
  el.classList.toggle('active');
}

function umGetPerms(){
  const p = {};
  Object.keys(permLabels).forEach(k=>{
    p[k] = document.getElementById('pt-'+k)?.classList.contains('active') || false;
  });
  return p;
}

function umSave(){
  const idx = parseInt(document.getElementById('um-edit-idx').value);
  const nama = document.getElementById('um-nama').value.trim();
  const uname = document.getElementById('um-username').value.trim();
  const role = document.getElementById('um-role').value;
  const cabang = document.getElementById('um-cabang').value;
  const pwd = document.getElementById('um-password').value;
  const isAdd = idx === -1;

  if(!nama || !uname){ showToast('Nama dan username wajib diisi!','error'); return; }
  if(isAdd && !pwd){ showToast('Password wajib diisi untuk akun baru!','error'); return; }
  if(pwd && pwd.length < 8){ showToast('Password minimal 8 karakter!','error'); return; }

  // MED-2 FIX: cek duplikasi username — tidak boleh ada dua admin dengan username sama
  const isDupUsername = adminUsers.some(function(u, i){ return u.username === uname && i !== idx; });
  if(isDupUsername){ showToast('Username sudah dipakai oleh admin lain!','error'); return; }

  const perms = umGetPerms();
  // Handle cabang baru
  let finalCabang = cabang;
  if(cabang === '__baru__'){
    const namaBaruEl = document.getElementById('um-cabang-baru');
    const namaBaru = namaBaruEl ? namaBaruEl.value.trim() : '';
    if(!namaBaru){ showToast('Masukkan nama cabang baru!','error'); return; }
    finalCabang = namaBaru;
    // Daftarkan ke cabangData jika belum ada
    const alreadyExists = cabangData.some(c=>c.name.toLowerCase()===namaBaru.toLowerCase());
    if(!alreadyExists){
      const newId = String(cabangData.length+1).padStart(2,'0');
      cabangData.push({id:newId, name:namaBaru, addr:'—', jam:'08.00–21.00', rating:5, wa:'', open:true, lat:0, lng:0, mapsUrl:'', type:'cabang'});
      // Tambahkan opsi ke semua select cabang dalam modal
      // FIX v92b: gunakan namaBaru (nama lengkap) sebagai value — konsisten dengan cabangData.name
      ['um-cabang'].forEach(selId=>{
        const selEl = document.getElementById(selId);
        if(selEl){
          const newOpt = document.createElement('option');
          newOpt.value = namaBaru;
          newOpt.textContent = namaBaru;
          selEl.insertBefore(newOpt, selEl.querySelector('option[value="__baru__"]'));
          selEl.value = namaBaru;
        }
      });
      // Tutup field baru
      const baruInput = document.getElementById('um-cabang-baru');
      if(baruInput) baruInput.style.display = 'none';
      showToast(`Cabang "${namaBaru}" berhasil ditambahkan ke sistem!`,'success');
      _sbLogActivity(`Tambah cabang baru: ${namaBaru}`);
      renderCabang();
      // FIX v92: Simpan cabang baru ke Supabase agar muncul setelah refresh
      (async function(){
        const _sbC = getSB();
        if(!_sbC) return;
        const { error: cabInsErr } = await _sbC.from('cabang').insert({
          id: newId,
          name: namaBaru,
          addr: '—',
          jam: '08.00–21.00',
          rating: 5,
          wa: '',
          open: true,
          lat: 0,
          lng: 0,
          maps_url: '',
          type: 'cabang'
        });
        if(cabInsErr){
          console.warn('[KD] Gagal simpan cabang baru ke DB:', cabInsErr.message);
        } else {
          console.log('[KD] Cabang baru tersimpan ke DB:', namaBaru);
        }
      })();
    }
  }
  if(isAdd){
    const initial = nama.split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join('');
    // BUG-M3 FIX: jangan simpan pwd plaintext di array — Supabase handle hashing
    adminUsers.push({name:nama,username:uname,initial,role,cabang:finalCabang,perms});
    _sbLogActivity(`Tambah akun baru: ${nama} (${role})`);
    // FIX v90 (KRITIS): Tambah user baru ke Supabase Auth + admin_profiles
    // MASALAH LAMA: auth.signUp() memerlukan email confirmation — akun @kd.internal
    // tidak akan pernah bisa konfirmasi, sehingga login selalu gagal.
    // SOLUSI: Pakai Edge Function /admin-create-user yang memanggil supabase.auth.admin.createUser()
    // (bypass email confirmation). Fallback ke signUp jika Edge Function tidak tersedia.
    (async function(){
      const _sb = getSB();
      if(!_sb){ showToast(`Akun ${nama} berhasil ditambahkan!`,'success'); return; }

      const emailAuth = uname.replace(/[^a-z0-9_.\-]/gi,'').toLowerCase() + '@kd.internal';

      // ── Langkah 1: Buat user Auth tanpa email confirmation ──
      let newUserId = null;
      let authOk = false;

      // Coba via Vercel API route /api/create-user (pakai SUPABASE_SERVICE_ROLE_KEY)
      try {
        const efRes = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailAuth, password: pwd, display_name: nama, role: role })
        });
        const efData = await efRes.json();
        if(efRes.ok){
          newUserId = efData?.user?.id || null;
          authOk = true;
          console.log('[KD] create-user API sukses, userId:', newUserId);
        } else {
          // API ada tapi return error (mis. duplicate email, env var kurang)
          console.warn('[KD] create-user API error:', efRes.status, efData?.error);
          showToast('⚠️ create-user error: ' + (efData?.error || efRes.status), 'error');
          // Tetap fallback ke signUp
        }
      } catch(efErr){
        console.warn('[KD] /api/create-user tidak tersedia:', efErr.message, '— fallback signUp');
      }

      // Fallback: auth.signUp() — user harus dikonfirmasi manual di Supabase Dashboard
      // atau Supabase dikonfigurasi dengan "Confirm email" = OFF
      if(!authOk){
        const { data: signUpData, error: signUpErr } = await _sb.auth.signUp({
          email: emailAuth,
          password: pwd,
          options: { data: { display_name: nama, role: role } }
        });
        if(signUpErr){
          // Jika error "User already registered" berarti akun sudah ada di Auth — lanjut saja
          if(!signUpErr.message.includes('already registered')){
            showToast(`Gagal daftar Auth: ${signUpErr.message} — coba aktifkan "Disable email confirmations" di Supabase Dashboard > Auth > Settings`,'error');
          }
          // Tetap insert profil (tanpa user_id) agar data tersimpan
        } else {
          newUserId = signUpData?.user?.id || null;
          authOk = true;
          // Jika user tidak null tapi session null → butuh konfirmasi email
          if(signUpData?.user && !signUpData?.session){
            showToast(`⚠️ Akun ${nama} dibuat tapi perlu konfirmasi email. Aktifkan "Disable email confirmations" di Supabase Dashboard > Auth > Settings agar bisa langsung login.`,'error');
          }
        }
      }

      // ── Langkah 2: Insert ke admin_profiles ──
      const { error: insErr } = await _sb.from('admin_profiles')
        .insert({
          display_name: nama,
          username: uname,
          email_auth: emailAuth,
          role: role,
          cabang_name: finalCabang,
          permissions: perms,
          active: true,
          ...(newUserId ? { user_id: newUserId } : {})
        });
      if(insErr){
        showToast(`Auth berhasil, tapi gagal simpan profil: ${insErr.message}`,'error');
      } else if(authOk) {
        showToast(`Akun ${nama} berhasil ditambahkan & bisa langsung login!`,'success');
        loadAdminUsers(); // refresh list
      } else {
        showToast(`Profil ${nama} tersimpan, tapi Auth perlu konfirmasi manual.`,'error');
        loadAdminUsers();
      }
    })();
  } else {
    // v86 FIX: ubah jadi async agar await Supabase selesai dulu sebelum close modal
    // Sebelumnya fire-and-forget → modal sudah tutup tapi DB belum tersimpan
    const _editIdx = idx; // capture idx sebelum async
    (async function(){
      const _sb = getSB();
      const targetId = adminUsers[_editIdx] && adminUsers[_editIdx].id;

      // Update lokal dulu (optimistic)
      adminUsers[_editIdx].name = nama;
      adminUsers[_editIdx].username = uname;
      adminUsers[_editIdx].role = role;
      adminUsers[_editIdx].cabang = finalCabang;
      adminUsers[_editIdx].perms = perms;

      // Jika yang diedit adalah user yang sedang login, update session sekarang
      if(window._currentAdmin && window._currentAdmin.username === uname){
        window._currentPerms = perms;
        window._currentAdmin.permissions = perms;
        window._currentAdmin.role = role;
        currentUserRole = role;
        renderDashboardForRole();
      }

      umCloseModal();
      renderUserMgmt();
      _sbLogActivity(`Update akun: ${nama}`);

      // Simpan ke Supabase (await penuh — bukan fire-and-forget)
      if(_sb){
        let sbError = null;
        if(targetId){
          // Cara 1: UPDATE by id (paling akurat)
          const { error } = await _sb.from('admin_profiles')
            .update({ permissions: perms, role: role, cabang_name: finalCabang, display_name: nama, username: uname })
            .eq('id', targetId);
          sbError = error;
        } else {
          // Cara 2: Fallback UPDATE by username (akun lama tanpa .id di cache)
          console.warn('[KD] umSave: targetId missing, fallback by username:', uname);
          const { error } = await _sb.from('admin_profiles')
            .update({ permissions: perms, role: role, cabang_name: finalCabang, display_name: nama })
            .eq('username', uname);
          sbError = error;
        }
        if(sbError){
          showToast('⚠️ Gagal simpan ke server: ' + sbError.message, 'error');
          console.error('[KD] umSave update error:', sbError);
        } else {
          showToast(`✅ ${nama} berhasil diperbarui & tersimpan ke database`, 'success');
          console.log('[KD] umSave: permissions updated in DB for', uname, perms);
        }
      }
    })();
    return; // async block handles everything including umCloseModal
  }
  umCloseModal();
  renderUserMgmt();
}

// --- UM DELETE ---
function umOpenDelete(idx){
  if(adminUsers[idx].role === 'superadmin'){
    // BUG FIX TC-47: blokir penghapusan jika hanya tersisa 1 superadmin
    const superadminCount = adminUsers.filter(u => u.role === 'superadmin').length;
    if(superadminCount <= 1){
      showToast('Tidak dapat menghapus Super Admin terakhir! Sistem harus memiliki minimal 1 Super Admin.','error');
      return;
    }
  }
  umDeleteTarget = idx;
  document.getElementById('um-delete-name').textContent = adminUsers[idx].name;
  document.getElementById('um-delete-confirm-input').value = '';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.body.classList.add('modal-nav-hidden'); document.getElementById('um-delete-overlay').classList.add('show');
  }); });
}

function umConfirmDelete(){
  if(document.getElementById('um-delete-confirm-input').value !== 'HAPUS'){
    showToast('Ketik HAPUS untuk konfirmasi!','error'); return;
  }
  // BUG-FIX v60 WB-02: cegah superadmin menghapus akun dirinya sendiri
  if(window._currentAdmin && adminUsers[umDeleteTarget] &&
     adminUsers[umDeleteTarget].username === window._currentAdmin.username){
    showToast('Tidak bisa menghapus akun yang sedang aktif!','error'); return;
  }
  const target = adminUsers[umDeleteTarget];
  const name = target.name;
  const username = target.username;
  const targetId = target.id || null;

  // Tutup modal & update UI dulu (optimistic)
  adminUsers.splice(umDeleteTarget, 1);
  document.body.classList.remove('modal-nav-hidden');
  document.getElementById('um-delete-overlay').classList.remove('show');
  renderUserMgmt();
  _sbLogActivity(`Hapus akun: ${name}`);

  // FIX v92: Hapus dari Supabase admin_profiles + Auth via Vercel API
  (async function(){
    const _sb = getSB();
    // 1. Hapus dari admin_profiles
    if(_sb){
      const { error: delErr } = await _sb.from('admin_profiles')
        .delete()
        .eq(targetId ? 'id' : 'username', targetId || username);
      if(delErr){
        console.error('[KD] umConfirmDelete: gagal hapus admin_profiles:', delErr.message);
        showToast(`⚠️ Hapus profil gagal: ${delErr.message}`, 'error');
        return;
      }
    }
    // 2. Hapus dari Supabase Auth via Vercel API route (butuh service_role)
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, id: targetId })
      });
      if(!res.ok){
        const errData = await res.json();
        console.warn('[KD] delete-user API error:', errData.error);
        // Bukan fatal — profil sudah terhapus, Auth user tidak bisa login karena profil hilang
      }
    } catch(e){ console.warn('[KD] delete-user API tidak tersedia:', e.message); }

    showToast(`Akun ${name} berhasil dihapus!`, 'success');
    loadAdminUsers(); // refresh dari DB
  })();
}

// --- UM CHANGE PASSWORD ---
function umChangePasswordSelf(){
  umChPwdTarget = -1;
  document.getElementById('um-chpwd-subtitle').textContent = 'Ubah password akun Anda sendiri';
  document.getElementById('um-oldpwd-group').style.display = 'block';
  document.getElementById('um-oldpwd').value = '';
  document.getElementById('um-newpwd').value = '';
  document.getElementById('um-confirmpwd').value = '';
  document.getElementById('pwd-bar2').style.width = '0';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.body.classList.add('modal-nav-hidden'); document.getElementById('um-chpwd-overlay').classList.add('show');
  }); });
}

function umOpenChangeUsername(){
  const profile = window._currentAdmin;
  const display = document.getElementById('um-current-username-display');
  if(display) display.textContent = profile?.username || '—';
  document.getElementById('um-new-username').value = '';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.body.classList.add('modal-nav-hidden'); document.getElementById('um-chusername-overlay').classList.add('show');
  }); });
}

function umChangePasswordFor(idx){
  umChPwdTarget = idx;
  document.getElementById('um-chpwd-subtitle').textContent = `Reset password untuk: ${adminUsers[idx].name}`;
  document.getElementById('um-oldpwd-group').style.display = 'none';
  document.getElementById('um-newpwd').value = '';
  document.getElementById('um-confirmpwd').value = '';
  document.getElementById('pwd-bar2').style.width = '0';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    document.body.classList.add('modal-nav-hidden'); document.getElementById('um-chpwd-overlay').classList.add('show');
  }); });
}

async function umDoChangePassword(){
  const np = document.getElementById('um-newpwd').value;
  const cp = document.getElementById('um-confirmpwd').value;
  if(np.length < 8){ showToast('Password minimal 8 karakter!','error'); return; }
  if(np !== cp){ showToast('Konfirmasi password tidak cocok!','error'); return; }

  if(umChPwdTarget === -1){
    // Ubah password akun sendiri
    const op  = document.getElementById('um-oldpwd').value;
    if(!op){ showToast('Masukkan password lama terlebih dahulu!','error'); return; }
    const btn = document.querySelector('#um-chpwd-overlay .btn-um-save');
    if(btn){ btn.textContent='Memverifikasi...'; btn.disabled=true; }

    // Verifikasi password lama: re-sign-in pakai email_auth dari profil
    const profile = window._currentAdmin;
    const emailAuth = profile?.email_auth;
    if(!emailAuth){
      if(btn){ btn.textContent='Simpan Password'; btn.disabled=false; }
      showToast('Sesi tidak valid, silakan login ulang.','error'); return;
    }

    // ✅ BUG FIX #10 (LOW) — QA: getSB() bisa null jika Supabase JS belum load → TypeError crash
    // JANGAN hapus null check ini — selalu validasi getSB() sebelum memanggil .auth
    const _sb = getSB();
    if(!_sb){
      if(btn){ btn.textContent='Simpan Password'; btn.disabled=false; }
      showToast('Koneksi server tidak tersedia, coba lagi.','error'); return;
    }
    const { error: verifyErr } = await _sb.auth.signInWithPassword({ email: emailAuth, password: op });
    if(verifyErr){
      if(btn){ btn.textContent='Simpan Password'; btn.disabled=false; }
      showToast('Password lama salah!','error'); return;
    }

    // Password lama benar → update ke password baru
    if(btn) btn.textContent='Menyimpan...';
    const { error } = await _sb.auth.updateUser({ password: np });
    if(btn){ btn.textContent='Simpan Password'; btn.disabled=false; }
    if(error){ showToast('Gagal: '+error.message,'error'); return; }

    _sbLogActivity('Ubah password akun sendiri', profile?.display_name||'Admin');
    showToast('Password berhasil diperbarui','success');

  } else {
    // Reset password admin cabang — butuh service_role key, tidak bisa dari browser
    // v53 FIX: tampilkan link langsung ke Supabase Dashboard agar lebih user-friendly
    const dashUrl = 'https://supabase.com/dashboard/project/' + SUPABASE_URL.replace('https://','').split('.')[0] + '/auth/users';
    showToast('Reset password admin lain: buka Supabase Dashboard → klik link di bawah','error');
    setTimeout(function(){
      // FIX v129: ganti confirm() ke toast + auto-open (reset password tidak destruktif)
      showToast('Membuka Supabase Dashboard untuk reset password...','info');
      if(true){
        window.open(dashUrl, '_blank');
      }
    }, 600);
  }
  document.body.classList.remove('modal-nav-hidden'); document.getElementById('um-chpwd-overlay').classList.remove('show');
  renderUserMgmt();
}

// ====== GANTI USERNAME (update tabel admin_profiles) ======
async function umDoChangeUsername(){
  const newUsername = document.getElementById('um-new-username')?.value?.trim().toLowerCase();
  if(!newUsername){ showToast('Username tidak boleh kosong!','error'); return; }
  if(!/^[a-z0-9_]+$/.test(newUsername)){ showToast('Username hanya boleh huruf kecil, angka, dan underscore.','error'); return; }

  const profile = window._currentAdmin;
  if(!profile?.id){ showToast('Sesi tidak valid.','error'); return; }

  // Cek apakah username sudah dipakai
  // FIX BUG-C3: getSB() bisa null jika Supabase belum load — tambahkan null check
  const _sbUn = getSB();
  if(!_sbUn){ showToast('Koneksi server tidak tersedia, coba lagi.','error'); return; }
  const { data: existing } = await _sbUn.from('admin_profiles').select('id').eq('username', newUsername).single();
  if(existing){ showToast('Username sudah dipakai, coba yang lain.','error'); return; }

  const btn = document.getElementById('btn-save-username');
  if(btn){ btn.textContent='Menyimpan...'; btn.disabled=true; }

  const { error } = await _sbUn.from('admin_profiles')
    .update({ username: newUsername })
    .eq('id', profile.id);

  if(btn){ btn.textContent='Simpan Username'; btn.disabled=false; }
  if(error){ showToast('Gagal: '+error.message,'error'); return; }

  // Update session lokal
  window._currentAdmin.username = newUsername;
  _sbLogActivity(`Ubah username → ${newUsername}`, profile.display_name||'Admin');
  showToast(`Username berhasil diubah ke "${newUsername}"`,'success');

  // Tutup modal & refresh
  document.getElementById('um-chusername-overlay')?.classList.remove('show');
  renderUserMgmt();
}

// --- PASSWORD TOGGLE ---
// ✅ BUG FIX #6 (MEDIUM) — QA: inkonsistensi visual di Android, icon mata pakai emoji bukan SVG
// ROOT CAUSE: btn.textContent = show ? '🙈' : '👁' — emoji rendering tidak konsisten antar platform
// FIX: ganti ke SVG inline (konsisten dengan seluruh proyek yang sudah migrasi emoji→SVG sejak v7)
// JANGAN ubah kembali ke emoji — gunakan SVG untuk semua icon di proyek ini
function umTogglePwd(inputId, btn){
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  // SVG eye-open dan eye-off — konsisten dengan design system (bukan emoji)
  btn.innerHTML = show
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// --- PASSWORD STRENGTH ---
function umCheckStrength(val){ _pwdStrength(val,'pwd-bar','pwd-hint'); }
function umCheckStrength2(val){ _pwdStrength(val,'pwd-bar2','pwd-hint2'); }
function _pwdStrength(val,barId,hintId){
  const bar=document.getElementById(barId), hint=document.getElementById(hintId);
  if(!bar)return;
  let score=0;
  if(val.length>=8) score++;
  if(/[A-Z]/.test(val)) score++;
  if(/[0-9]/.test(val)) score++;
  if(/[^A-Za-z0-9]/.test(val)) score++;
  const colors=['#DC2626','#F59E0B','#3A9E6E','#2D5A8E'];
  const labels=['Terlalu lemah','Cukup','Kuat','Sangat kuat'];
  bar.style.width=(score/4*100)+'%';
  bar.style.background=colors[score-1]||'#DC2626';
  if(hint) hint.textContent = score ? labels[score-1] : 'Gunakan kombinasi huruf besar, kecil, angka & simbol';
}


// ============ PANEL SWITCH ============
const panelTitles={dashboard:'Dashboard Utama','input-penjualan':'Input Penjualan','input-stok':'Input Stok',analitik:'Analitik Bisnis','menu-mgmt':'Manajemen Menu','cabang-mgmt':'Manajemen Cabang','promo-mgmt':'Manajemen Promo','order-tracking':'Order Tracking','franchise-list':'Permohonan Kemitraan',feedback:'Feedback Pelanggan','user-mgmt':'Manajemen User',katalog:'Katalog','bahan-baku':'Manajemen Bahan Baku','laporan-produksi':'Laporan Produksi'};
// MED-4 FIX: ekstrak logika bersama ke _doSwitchPanel agar tidak ada duplikasi
// Sebelumnya switchPanel dan switchPanelDirect copy-paste identik → jika ada bug di satu, mudah terlewat di yang lain
const _panelPermMap = {
  'input-penjualan': 'penjualan',
  'analitik':        'analitik',
  'menu-mgmt':       'menu',
  'cabang-mgmt':     'menu',
  'promo-mgmt':      'menu',
  'user-mgmt':       'user',
  'input-stok':      'stok',
  'feedback':        'feedback',
  'franchise-list':  'franchise',
  'katalog':         '_superadmin_only_',
  'bahan-baku':      'bahan_baku',
  'laporan-produksi':'laporan_produksi',
};
function _doSwitchPanel(name, navEl){
  // v85 FIX: guard race condition — jika _currentAdmin belum ada dan ini bukan dashboard,
  // tunggu sebentar sampai profile ter-apply. Mencegah superadmin kena "Akses Terbatas"
  // saat session restore belum selesai tapi switchPanel sudah dipanggil.
  if(!window._currentAdmin && name !== 'dashboard'){
    setTimeout(function(){ _doSwitchPanel(name, navEl); }, 200);
    return;
  }
  const isSA = currentUserRole === 'superadmin';
  const perms = window._currentPerms || {};
  const permRequired = _panelPermMap[name];
  if(permRequired === '_superadmin_only_' && !isSA){
    showToast('Akses ditolak — fitur ini khusus Super Admin','error');
    return;
  }
  if(permRequired && permRequired !== '_superadmin_only_' && !isSA && !perms[permRequired]){
    showToast('Akses ditolak — Anda tidak memiliki izin untuk fitur ini','error');
    return;
  }
  document.querySelectorAll('.admin-panel').forEach(p=>{p.classList.remove('active');p.style.display='none';p.style.opacity='';p.style.transform='';});
  const target=document.getElementById('panel-'+name);
  if(target){
    target.style.display='block';
    target.style.opacity='1';
    target.style.transform='translateY(0)';
    requestAnimationFrame(()=>{target.classList.add('active','panel-enter');setTimeout(()=>target.classList.remove('panel-enter'),350);});
  }
  document.querySelectorAll('.admin-nav-item').forEach(n=>n.classList.remove('active','nav-activating'));
  if(navEl){navEl.classList.add('active');requestAnimationFrame(()=>{navEl.classList.add('nav-activating');setTimeout(()=>navEl.classList.remove('nav-activating'),400);});}
  const bubble=document.querySelector('.nav-bubble');
  if(bubble&&navEl) moveBubbleTo(navEl,bubble);
  document.getElementById('panel-title').textContent=panelTitles[name]||name;
  // FIX v114: sync franchise setting saat panel dibuka agar tombol admin up-to-date
  if(name === 'franchise-list') setTimeout(_loadFranchiseSetting, 100);
  // FIX v136: wrap dengan _loadSupabase agar Supabase JS + session sudah ready
  // sebelum query, lalu log error jika ada untuk diagnosa RLS/auth issue.
  if(name === 'feedback'){
    var tFbLoading = document.getElementById('tbl-feedback');
    if(tFbLoading) tFbLoading.innerHTML = '<tbody><tr class="tbl-empty"><td colspan="5" style="color:var(--text3)">Memuat feedback...</td></tr></tbody>';
    _loadSupabase(function(){
      var sb = getSB();
      if(sb){
        sb.from('feedback').select('*').order('created_at',{ascending:false})
          .then(function(res){
            if(res.error){
              console.warn('[KD] feedback load error:', res.error.message, res.error.code);
              var errEl = document.getElementById('feedback-error-msg');
              if(errEl){ errEl.style.display='block'; errEl.textContent='Gagal memuat feedback: '+res.error.message+' ('+res.error.code+')'; }
              renderAdminTables();
              return;
            }
            var errEl2 = document.getElementById('feedback-error-msg');
            if(errEl2) errEl2.style.display='none';
            if(res.data){
              window._feedbackList = res.data;
              feedbackList.length = 0;
              res.data.forEach(function(r){
                feedbackList.push({id:r.id,nama:r.nama||r.name||'—',email:r.email||'',subjek:r.subjek||'Kontak',cabang:r.cabang||'—',rating:r.rating||0,pesan:r.pesan||r.message||'',tanggal:r.tanggal||r.created_at?.slice(0,10)||'—'});
              });
            }
            renderAdminTables();
          })
          .catch(function(e){ console.warn('[KD] feedback fetch exception:', e); renderAdminTables(); });
      } else {
        console.warn('[KD] feedback panel: getSB() null setelah _loadSupabase');
        renderAdminTables(); // fallback: render dari cache
      }
    });
  }
  if(name === 'franchise-list'){
    var sb2 = getSB();
    if(sb2){
      sb2.from('franchise_applications').select('*').order('created_at',{ascending:false})
        .then(function(res2){
          if(!res2.error && res2.data){
            window._franchiseApplicants = res2.data;
            franchiseApplicants.length = 0;
            res2.data.forEach(function(r){
              franchiseApplicants.push({id:r.id,nama:r.nama||r.name||'—',wa:r.wa||r.whatsapp||'—',kota:r.kota||r.city||'—',modal:r.modal||r.modal_budget||'—',pesan:r.pesan||'',status:r.status||'Menunggu',created_at:r.created_at});
            });
          }
          renderAdminTables();
        });
    } else {
      renderAdminTables();
    }
  }
  const backBtn=document.getElementById('admin-back-btn');
  if(backBtn) backBtn.style.display=name==='dashboard'?'none':'flex';
  if(name==='analitik'){ setTimeout(()=>{ _loadChartJs(function(){ renderAnalitikKPICards(); initAnalitikCharts(); _initAnalitikBulanFilter(); }); },120); }
  if(name==='user-mgmt'){ _loadSupabase(function(){ loadAdminUsers(); }); }
  if(name==='katalog'){ renderKatalogGrid('all'); bannerRenderAll(); }
  if(name==='input-penjualan') pjInit();
  if(name==='input-stok') skInit();
  if(name==='bahan-baku') bbInit();
  if(name==='laporan-produksi') lpInit();
  if(name==='dashboard') renderDashboardForRole(); else { _stopRealtimeClock(); _stopSaClock(); _stopRealtimeChart(); }
  if(navEl) updateNavIndicator(navEl);
  window.scrollTo(0,0);
  // Mobile: scroll konten panel ke atas
  var ac=document.querySelector('.admin-content'); if(ac) ac.scrollTop=0;
}
function switchPanel(name,el){ _doSwitchPanel(name, el); }
function switchPanelDirect(name){ _doSwitchPanel(name, null); }

// ============ HELPER: hitung % perubahan omset bulan ini vs bulan lalu ============
// Filter dari omsetHistory berdasarkan cabang (opsional, null = semua cabang)
function _calcOmsetChange(cabangFilter){
  var now = new Date();
  var thisYear = now.getFullYear(), thisMon = now.getMonth()+1;
  var prevYear = thisMon === 1 ? thisYear-1 : thisYear;
  var prevMon  = thisMon === 1 ? 12 : thisMon-1;
  var padMon = function(m){ return m < 10 ? '0'+m : String(m); };
  var thisPrefix = thisYear+'-'+padMon(thisMon);
  var prevPrefix = prevYear+'-'+padMon(prevMon);
  var data = cabangFilter
    ? omsetHistory.filter(function(o){ return o.cabang === cabangFilter; })
    : omsetHistory;
  var thisTotal = data.filter(function(o){ return o.tanggal && o.tanggal.startsWith(thisPrefix); })
                      .reduce(function(s,o){ return s+o.omset; }, 0);
  var prevTotal = data.filter(function(o){ return o.tanggal && o.tanggal.startsWith(prevPrefix); })
                      .reduce(function(s,o){ return s+o.omset; }, 0);
  if(prevTotal === 0 && thisTotal === 0) return { text: 'Belum ada data bulan ini', cls: '' };
  if(prevTotal === 0) return { text: '— (data bulan lalu belum ada)', cls: '' };
  var pctNum = (thisTotal - prevTotal) / prevTotal * 100;
  var up = pctNum >= 0;
  var pctStr = Math.abs(pctNum).toFixed(1); // toFixed SETELAH abs → tidak kehilangan desimal
  return { text: (up ? '↑ ' : '↓ ') + pctStr + '% dari bulan lalu', cls: up ? 'up' : 'down' };
}

// ============ DASHBOARD ROLE-AWARE RENDERING ============
function renderDashboardForRole(){
  const role = currentUserRole || 'staff';
  const profile = window._currentAdmin;
  const isSuperAdmin = (role === 'superadmin');
  const myCabang = profile ? (profile.cabang_name || profile.cabang || '') : '';
  const today = new Date().toISOString().slice(0,10);

  // v58 FIX: Pastikan branch-modal-overlay TERTUTUP saat render dashboard
  // Cegah modal "Pilih Cabang" nyangkut terbuka di atas dashboard
  const bmoCheck = document.getElementById('branch-modal-overlay');
  if(bmoCheck) bmoCheck.classList.remove('open');
  const bptCheck = document.getElementById('branch-picker-trigger');
  if(bptCheck) bptCheck.classList.remove('open');

  // v58 FIX: Auto-set & lock branch picker Omset untuk non-superadmin
  // Admin/staff cabang tidak perlu pilih cabang — otomatis dari profil login
  const bpt = document.getElementById('branch-picker-trigger');
  const bpText = document.getElementById('branch-picker-text');
  const bpChevron = document.getElementById('branch-picker-chevron');
  const oCabang = document.getElementById('o-cabang');
  if(!isSuperAdmin && myCabang){
    // Lock: isi otomatis, nonaktifkan klik
    if(oCabang) oCabang.value = myCabang;
    if(bpText) bpText.textContent = myCabang;
    if(bpt){
      bpt.classList.add('has-value');
      bpt.style.cursor = 'not-allowed';
      bpt.style.opacity = '0.85';
      bpt.title = 'Cabang dikunci otomatis sesuai akun Anda';
    }
    if(bpChevron) bpChevron.style.display = 'none';
  } else {
    // Superadmin: biarkan bisa pilih
    if(bpt){ bpt.style.cursor = ''; bpt.style.opacity = ''; bpt.title = ''; }
    if(bpChevron) bpChevron.style.display = '';
  }

  // PERMISSIONS-DYN: baca dari _currentPerms (dari Supabase), fallback ke role-based
  // v87 FIX: pakai _mergePerms (non-SA default false, nilai DB menang)
  // Jangan default semua true — itu yang menyebabkan semua shortcut selalu muncul
  const perms = _mergePerms(window._currentPerms, role);
  function can(key){ return isSuperAdmin || perms[key] === true; }

  // Map: id elemen → permission key
  // v84: null-safe — skip jika elemen tidak ditemukan di DOM
  // v84b: LENGKAP — semua nav item + semua shortcut card dicover
  const visMap = {
    // Nav sidebar/mobile
    'nav-input-penjualan':      'penjualan',
    'nav-input-stok':           'stok',
    'nav-analitik':             'analitik',
    // Shortcut cards Dashboard
    'shortcut-input-penjualan': 'penjualan',
    'shortcut-input-stok':      'stok',
    'shortcut-analitik':        'analitik',
    'shortcut-menu-mgmt':       'menu',
    'shortcut-cabang-mgmt':     'menu',
    'shortcut-promo-mgmt':      'menu',
    'shortcut-user-mgmt':       'user',
    'shortcut-feedback':        'feedback',
    'shortcut-franchise-list':  'franchise',
    'shortcut-bahan-baku':      'bahan_baku',
    'shortcut-laporan-produksi':'laporan_produksi',
  };
  Object.entries(visMap).forEach(function([id, key]){
    const el = document.getElementById(id);
    if(el) el.style.display = can(key) ? '' : 'none';
  });
  // v84 FIX #2: setelah visMap diterapkan, sync bubble nav mobile ke item aktif yang masih visible
  _syncNavBubble();

  // ── Banner role indicator ──
  const banner = document.getElementById('dashboard-role-banner');
  if(banner){
    if(isSuperAdmin){
      banner.style.display = 'block';
      banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="vertical-align:-.15em" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> <strong>Super Admin</strong> — Menampilkan akumulasi data dari seluruh ' + cabangData.filter(c=>c.type==='cabang').length + ' unit cabang';
    } else {
      banner.style.display = 'block';
      banner.style.background = 'rgba(78,127,196,.07)';
      banner.style.borderColor = 'rgba(78,127,196,.18)';
      banner.style.color = '#4E7FC4';
      banner.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="vertical-align:-.15em" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> <strong>Dashboard Kedai</strong> — Data khusus untuk ' + (myCabang || 'cabang Anda');
    }
  }

  if(isSuperAdmin){
    // ── SUPER ADMIN: akumulasi dari seluruh cabang ──
    // v124b FIX: filter ke bulan ini saja untuk KPI "Omset Bulan Ini"
    var nowSA = new Date();
    var thisPrefixSA = nowSA.getFullYear()+'-'+String(nowSA.getMonth()+1).padStart(2,'0');
    const omsetBulanIni = omsetHistory.filter(o=>o.tanggal&&o.tanggal.startsWith(thisPrefixSA));
    const totalOmset = omsetBulanIni.reduce((s,o)=>s+o.omset,0);
    // v124b FIX: totalTrx juga filter bulan ini (bukan all-time) agar konsisten dengan KPI Omset
    const totalTrx = omsetBulanIni.reduce((s,o)=>s+o.trx,0);
    // v124b FIX: sertakan Rumah Produksi di count cabang aktif
    const cabangAktif = cabangData.filter(c=>(c.type==='cabang'||c.type==='produksi')&&c.open).length;
    // v124b FIX: KPI Stok = total semua kemasan + bahan baku (bukan hanya topping)
    const totalKemasanTop = cabangData.reduce((s,c)=>s+_invGetTopTotal(c.name),0);
    const totalBahanBaku = cabangData.reduce((s,c)=>s+_invGet(c.name,'Dimsum Original')+_invGet(c.name,'Dimsum Keju'),0);
    const totalStokAll = totalKemasanTop + totalBahanBaku;

    var omsetChg = _calcOmsetChange(null);
    _setKPI('kpi-omset','Rp '+_fmtJuta(totalOmset), omsetChg.text, omsetChg.cls, 'kpi-omset-label', 'Omset Bulan Ini (Semua Cabang)');
    // Superadmin: tidak pakai clock di card bulanan
    _stopRealtimeClock();
    const clockElSA = document.getElementById('kpi-omset-clock');
    if(clockElSA) clockElSA.style.display = 'none';
    // v63: Start SA real-time clock untuk card Omset Hari Ini
    _startSaRealtimeClock();
    _setKPI('kpi-cabang',String(cabangAktif),'dari '+cabangData.filter(c=>c.type==='cabang'||c.type==='produksi').length+' total unit','up','kpi-cabang-label','Unit Aktif');
    _setKPI('kpi-trx',totalTrx.toLocaleString('id-ID'),'transaksi bulan ini','up','kpi-trx-label','Total Transaksi');
    // v124b FIX: label KPI stok → "Total Stok" (kemasan + bahan baku), bukan hanya topping
    _setKPI('kpi-stok',totalStokAll.toLocaleString('id-ID')||'—',
      '📦 '+totalKemasanTop+' kemasan · 🥟 '+totalBahanBaku+' pcs',
      '','kpi-stok-label','Total Stok (Semua)');

    // Tampilkan tabel performa semua cabang (bulanan)
    // FIX v129 KRITIS-01: filter ke bulan ini agar kolom "Omset Bulan" tidak akumulasi all-time
    const omsetBulanIniPerf = omsetHistory.filter(o=>o.tanggal&&o.tanggal.startsWith(thisPrefixSA));
    const perf = omsetBulanIniPerf.reduce((acc,o)=>{
      if(!acc[o.cabang]) acc[o.cabang]={omset:0,trx:0};
      acc[o.cabang].omset+=o.omset; acc[o.cabang].trx+=o.trx; return acc;
    },{});
    // Hitung omset hari ini per cabang — pakai omsetHistory sebagai single source
    const today = new Date().toISOString().slice(0,10);
    const perfHari = {};
    const todayOmsetRows = omsetHistory.filter(o=>o.tanggal&&o.tanggal.slice(0,10)===today);
    const usePerfOmset = todayOmsetRows.length > 0;
    if(usePerfOmset){
      todayOmsetRows.forEach(o=>{
        if(!perfHari[o.cabang]) perfHari[o.cabang]={omset:0,trx:0};
        perfHari[o.cabang].omset+=(o.omset||0); perfHari[o.cabang].trx+=(o.trx||0);
      });
    } else {
      penjualanData.filter(p=>p.tanggal&&p.tanggal.slice(0,10)===today).forEach(p=>{
        if(!perfHari[p.cabang]) perfHari[p.cabang]={omset:0,trx:0};
        perfHari[p.cabang].omset+=(p.total||0); perfHari[p.cabang].trx+=1;
      });
    }
    const tp=document.getElementById('tbl-performa');
    const perfTitle=document.getElementById('tbl-performa-title');
    if(perfTitle) perfTitle.textContent='Performa Cabang Bulan Ini — Semua Unit';
    if(tp)tp.innerHTML=`<thead><tr><th>Cabang</th><th class="th-right">Omset Bulan</th><th class="th-center">Trx</th><th class="th-right">Hari Ini</th><th class="th-center">Stok Top</th><th>Stok Ori</th></tr></thead><tbody>${
      cabangData.filter(c=>c.type==='cabang'||c.type==='produksi').map(c=>{
        const d=perf[c.name]||{omset:0,trx:0};
        const dh=perfHari[c.name]||{omset:0,trx:0};
        return `<tr><td data-label="Cabang" style="font-weight:600;color:var(--text)">${c.name}</td>
          <td data-label="Omset Bulan" class="td-num" style="color:var(--red);font-weight:600">Rp ${d.omset.toLocaleString('id-ID')}</td>
          <td data-label="Trx" class="td-center">${d.trx.toLocaleString('id-ID')}</td>
          <td data-label="Hari Ini" class="td-num" style="color:${dh.omset>0?'var(--red)':'var(--text3)'};">${dh.omset>0?'Rp '+dh.omset.toLocaleString('id-ID'):'—'}</td>
          <td data-label="Stok Top" class="td-center">${_invGetTopTotal(c.name).toLocaleString('id-ID')} kemasan</td>
          <td data-label="Stok Ori" class="td-center">${_invGet(c.name,'Dimsum Original').toLocaleString('id-ID')} pcs</td></tr>`;
      }).join('')
    }</tbody>`;

    // Tampilkan grafik analitik (hanya superadmin)
    const cw = document.getElementById('dashboard-charts-wrap');
    if(cw) cw.style.display='';

    // Tampilkan grafik harian superadmin
    const hw = document.getElementById('chart-harian-wrap');
    if(hw) hw.style.display='';
    setTimeout(()=>initChartHarian(0), 200);
    // v65: Tampilkan chart real-time untuk superadmin juga
    _startRealtimeChart();

    // Sembunyikan laporan harian
    const dr = document.getElementById('daily-report-wrap');
    if(dr) dr.style.display='none';

  } else {
    // ── ADMIN/STAFF KEDAI: hanya data cabang sendiri + laporan harian ──
    // v140 FIX 2: KPI Bulanan + histori per bulan
    const saTodayCard = document.getElementById('kpi-sa-today-card');
    if(saTodayCard) saTodayCard.style.display = 'none';
    _stopSaClock();
    _stopRealtimeClock();

    // FIX v140: filter bulan INI untuk KPI bulanan (bukan all-time)
    var nowKedai = new Date();
    var thisMonPrefixKedai = nowKedai.getFullYear() + '-' + String(nowKedai.getMonth()+1).padStart(2,'0');

    var myBulanData = omsetHistory.filter(function(o){
      return o.cabang === myCabang && o.tanggal && o.tanggal.startsWith(thisMonPrefixKedai);
    });
    var todayData = penjualanData.filter(function(p){
      return p.cabang === myCabang && p.tanggal && p.tanggal.slice(0,10) === today;
    });

    var totalOmsetBulan = myBulanData.reduce(function(s,o){ return s + o.omset; }, 0);
    var totalTrxBulan   = myBulanData.reduce(function(s,o){ return s + o.trx;  }, 0);
    var totalOmsetHari  = todayData.reduce(function(s,p){ return s + p.total; }, 0);
    var topStok  = _invGetTopTotal(myCabang);
    var oriStok  = _invGet(myCabang,'Dimsum Original');
    var kejuStok = _invGet(myCabang,'Dimsum Keju');

    var omsetChgKedai = _calcOmsetChange(myCabang);

    // KPI 1: Omset Bulan Ini
    _setKPI('kpi-omset',
      'Rp '+_fmtJuta(totalOmsetBulan),
      totalTrxBulan+' trx · '+(omsetChgKedai.text||'—'),
      totalOmsetBulan>0?'up':'',
      'kpi-omset-label','Omset Bulan Ini'
    );
    var clockEl = document.getElementById('kpi-omset-clock');
    if(clockEl) clockEl.style.display = 'none';

    // KPI 2: Stok Topping
    _setKPI('kpi-cabang',topStok.toLocaleString('id-ID')||'0','kemasan tersedia','','kpi-cabang-label','Stok Topping');

    // KPI 3: Stok Bahan Baku
    var oriTotal = oriStok + kejuStok;
    _setKPI('kpi-trx',oriTotal.toLocaleString('id-ID')||'0','Ori '+oriStok+' · Keju '+kejuStok,'','kpi-trx-label','Stok Bahan Baku');

    // KPI 4: Omset Hari Ini
    _setKPI('kpi-stok',
      'Rp '+_fmtJuta(totalOmsetHari),
      todayData.length+' transaksi hari ini',
      todayData.length?'up':'',
      'kpi-stok-label','Omset Hari Ini'
    );

    // Tabel histori omset bulanan
    const tp = document.getElementById('tbl-performa');
    const perfTitle = document.getElementById('tbl-performa-title');
    if(perfTitle) perfTitle.textContent = 'Histori Omset Bulanan — '+myCabang;
    if(tp){
      var byMonth = {};
      omsetHistory.filter(function(o){ return o.cabang===myCabang && o.tanggal; }).forEach(function(o){
        var mon = o.tanggal.slice(0,7);
        if(!byMonth[mon]) byMonth[mon]={omset:0,trx:0};
        byMonth[mon].omset += o.omset;
        byMonth[mon].trx   += o.trx;
      });
      var months = Object.keys(byMonth).sort().reverse().slice(0,6);
      tp.innerHTML = '<thead><tr><th>Bulan</th><th class="th-right">Omset</th><th class="th-center">Trx</th><th class="th-right">Avg/Trx</th></tr></thead><tbody>'
        + (months.length ? months.map(function(m){
            var d = byMonth[m];
            var avg = d.trx>0 ? Math.round(d.omset/d.trx) : 0;
            var label = new Date(m+'-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
            var isThisMon = m === thisMonPrefixKedai;
            return '<tr style="'+(isThisMon?'background:rgba(184,50,50,.05)':'')+'">'
              + '<td style="color:var(--text'+(isThisMon?'':3)+');font-weight:'+(isThisMon?700:400)+'">'+label+(isThisMon?' <span style="font-size:.65rem;color:var(--red);font-weight:700">bulan ini</span>':'')+'</td>'
              + '<td class="td-num" style="color:var(--red);font-weight:600">Rp '+d.omset.toLocaleString('id-ID')+'</td>'
              + '<td class="td-center">'+d.trx+'</td>'
              + '<td class="td-num" style="color:var(--text3)">'+(avg>0?'Rp '+avg.toLocaleString('id-ID'):'—')+'</td>'
              + '</tr>';
          }).join('')
          : '<tr class="tbl-empty"><td colspan="4">Belum ada data omset</td></tr>'
        ) + '</tbody>';
    }

    const dr = document.getElementById('daily-report-wrap');
    if(dr) dr.style.display = 'block';
    const cw = document.getElementById('dashboard-charts-wrap');
    if(cw) cw.style.display = 'none';
    const hw = document.getElementById('chart-harian-wrap');
    if(hw) hw.style.display = 'none';
    _startRealtimeChart();

    const drDate = document.getElementById('daily-report-date');
    if(drDate) drDate.textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    const tdr = document.getElementById('tbl-daily-report');
    if(tdr){
      tdr.innerHTML = '<thead><tr><th>Waktu</th><th>Pelanggan</th><th>No. HP</th><th class="th-center">Pembayaran</th><th>Item</th><th class="th-right">Total</th></tr></thead><tbody>'
        + (todayData.length ? todayData.map(function(p){
            return '<tr>'
              + '<td style="font-size:.75rem;color:var(--text3)">'+( p.tanggal.slice(11,16)||'—')+'</td>'
              + '<td>'+_esc(p.pelanggan)+'</td>'
              + '<td style="font-size:.75rem;color:var(--text3)">'+(p.phone||'—')+'</td>'
              + '<td><span class="td-badge badge-open">'+_esc(p.bayar)+'</span></td>'
              + '<td style="font-size:.75rem;color:var(--text3)">'+(Array.isArray(p.items)?p.items.map(function(i){return _esc(i.name)+' x'+i.qty;}).join(', '):(p.items||'—'))+'</td>'
              + '<td class="td-num" style="color:var(--red);font-weight:700">Rp '+p.total.toLocaleString('id-ID')+'</td>'
              + '</tr>';
          }).join('')
          : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text4)">Belum ada transaksi hari ini — input di menu Penjualan</td></tr>'
        ) + '</tbody>';
    }

    const stokDetail = document.getElementById('daily-stok-detail');
    if(stokDetail) stokDetail.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">'
        +'<span style="font-size:.78rem;color:var(--text2);white-space:nowrap">Topping</span>'
        +'<span style="font-weight:800;font-size:1.1rem;font-family:\'Inter\',sans-serif;color:'+( topStok<50?'var(--red)':'var(--text)')+'">'+topStok+' <span style="font-size:.68rem;font-weight:400;color:var(--text4)">kemasan</span></span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
        +'<span style="font-size:.78rem;color:var(--text2);white-space:nowrap">Original</span>'
        +'<span style="font-weight:800;font-size:1.1rem;font-family:\'Inter\',sans-serif;color:'+(oriStok<100?'var(--red)':'var(--text)')+'">'+oriStok+' <span style="font-size:.68rem;font-weight:400;color:var(--text4)">pcs</span></span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px">'
        +'<span style="font-size:.78rem;color:var(--text2);white-space:nowrap">Keju</span>'
        +'<span style="font-weight:800;font-size:1.1rem;font-family:\'Inter\',sans-serif;color:'+(kejuStok<100?'var(--red)':'var(--text)')+'">'+kejuStok+' <span style="font-size:.68rem;font-weight:400;color:var(--text4)">pcs</span></span>'
      +'</div>'
      +( (topStok<50||oriStok<100||kejuStok<100) ? '<div style="margin-top:10px;font-size:.72rem;color:var(--red);font-weight:600">⚠️ Stok rendah — minta distribusi ke pusat</div>' : '' );

    const summaryStats = document.getElementById('daily-summary-stats');
    if(summaryStats) summaryStats.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">'
        +'<span style="font-size:.78rem;color:var(--text2)">Trx Hari Ini</span>'
        +'<span style="font-weight:800;font-size:1.1rem;color:var(--text)">'+todayData.length+'</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">'
        +'<span style="font-size:.78rem;color:var(--text2)">Omset Hari Ini</span>'
        +'<span style="font-weight:800;font-size:1rem;color:var(--red)">Rp '+_fmtJuta(totalOmsetHari)+'</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
        +'<span style="font-size:.78rem;color:var(--text2)">Omset Bulan Ini</span>'
        +'<span style="font-weight:700;font-size:.9rem;color:var(--red)">Rp '+_fmtJuta(totalOmsetBulan)+'</span>'
      +'</div>';
  }
}

function _setKPI(valId, val, sub, upClass, labelId, labelText){
  const vEl=document.getElementById(valId); if(vEl) vEl.textContent=val;
  // FIX BUG-M6: lookup sub-element dengan ID yang benar: valId+'-sub'
  // Sebelumnya ada no-op replace('kpi-','kpi-') yang tidak mengubah apapun → sub tidak pernah diupdate
  const subEl = document.getElementById(valId+'-sub');
  if(subEl){ subEl.textContent=sub; subEl.className='kpi-change'+(upClass?' '+upClass:''); }
  if(labelId){ const lEl=document.getElementById(labelId); if(lEl&&labelText) lEl.textContent=labelText; }
}

// FIX v67: _fmtJuta hanya dipakai untuk KPI cards (singkat).
// Untuk tabel & detail gunakan toLocaleString('id-ID') penuh.
function _fmtJuta(val){
  if(val>=1000000){
    const jt = val/1000000;
    // Jika pecahan > 2 desimal, tampilkan 2 desimal; jika bulat tampilkan tanpa desimal
    const str = Number.isInteger(jt) ? jt.toString() : jt.toFixed(2).replace(/\.?0+$/, '');
    return str + ' Jt';
  }
  if(val>=1000){
    const rb = val/1000;
    const str = Number.isInteger(rb) ? rb.toString() : rb.toFixed(1).replace(/\.0$/, '');
    return str + ' Rb';
  }
  return val.toLocaleString('id-ID');
}

// Nav ripple + slide indicator
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.admin-nav-item').forEach(item=>{
    item.addEventListener('click',function(e){
      const r=document.createElement('span');r.className='nav-ripple';
      const rect=this.getBoundingClientRect();
      const sz=Math.max(rect.width,rect.height);
      r.style.cssText=`width:${sz}px;height:${sz}px;left:${e.clientX-rect.left-sz/2}px;top:${e.clientY-rect.top-sz/2}px`;
      this.appendChild(r);setTimeout(()=>r.remove(),600);
    });
  });
  initCurrencyFields();

  // NOTE v71: nav.scrolled toggle dipindah ke unified scroll engine (runAllScrollWork step 2)
  // Listener terpisah di bawah ini DIHAPUS karena duplikat → menyebabkan scroll jank

  // Sliding bubble for mobile nav
  // FIX BUG-L6: bubble dibuat di fungsi terpisah agar bisa dipanggil ulang saat resize
  function _initMobileBubble(){
    const nav=document.querySelector('.admin-nav');
    if(!nav) return;
    let bubble=nav.querySelector('.nav-bubble');
    if(!bubble){
      bubble=document.createElement('div');
      bubble.className='nav-bubble';
      nav.insertBefore(bubble,nav.firstChild);
    }
    const activeItem=nav.querySelector('.admin-nav-item.active');
    if(activeItem) moveBubbleTo(activeItem, bubble);
  }
  if(window.innerWidth<=768) _initMobileBubble();
  // Reinit bubble saat resize melewati breakpoint 768px
  let _prevIsMobile = window.innerWidth<=768;
  window.addEventListener('resize', function(){
    const isMobile = window.innerWidth<=768;
    if(isMobile && !_prevIsMobile) _initMobileBubble();
    _prevIsMobile = isMobile;
  }, {passive:true});
});

// MOVE BUBBLE — PERF v11
// BEFORE: getBoundingClientRect() called, then style written, then getBoundingClientRect on same element
//         → interleaved reads+writes force multiple forced layouts per call
// AFTER: all reads batched first, then all writes in one go
function moveBubbleTo(el, bubble){
  if(!el||!bubble)return;
  var nav=el.closest('.admin-nav');
  if(!nav)return;
  // BATCH READ phase (no style writes between these)
  var navRect=nav.getBoundingClientRect();
  var itemRect=el.getBoundingClientRect();
  // BATCH WRITE phase
  bubble.style.left=(itemRect.left-navRect.left)+'px';
  bubble.style.top=(itemRect.top-navRect.top)+'px';
  bubble.style.width=itemRect.width+'px';
  bubble.style.height=itemRect.height+'px';
}
function updateNavIndicator(){}

// v84 FIX #2: _syncNavBubble — reposisi bubble nav mobile setelah visMap diubah
// Dipanggil dari renderDashboardForRole() agar bubble tidak stuck di item yang disembunyikan
function _syncNavBubble(){
  if(window.innerWidth > 768) return; // hanya berlaku untuk mobile bottom nav
  const nav = document.querySelector('.admin-nav');
  if(!nav) return;
  const bubble = nav.querySelector('.nav-bubble');
  if(!bubble) return;
  // Cari item aktif yang masih visible
  const activeItem = nav.querySelector('.admin-nav-item.active');
  if(activeItem && activeItem.style.display !== 'none'){
    moveBubbleTo(activeItem, bubble);
  } else {
    // Fallback: pindah bubble ke item visible pertama (Dashboard selalu ada)
    const firstVisible = Array.from(nav.querySelectorAll('.admin-nav-item'))
      .find(function(el){ return el.style.display !== 'none'; });
    if(firstVisible) moveBubbleTo(firstVisible, bubble);
  }
}
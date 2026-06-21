// ============ DATA ============
// v65: DEFAULT_MENU — sumber kebenaran untuk reset katalog
// v120: Update menu sesuai brosur resmi — tambah goreng, hapus minuman/paket, sesuaikan harga & item topping
const DEFAULT_MENU=[
  // ── DIMSUM TOPPING ── (v123: semua topping pakai VOIL, tidak ada Dus lagi kecuali Snackbox)
  {id:5,  name:'Snackbox 4 Pcs',                 desc:'Dimsum Topping 4 pcs dalam box snackbox. Cocok untuk ngemil & acara.',                      price:15000,  cat:'topping',  img:'gambar/05_snackbox_4pcs.png',           badge:'',           tags:[], inStock:true, packaging:'Box 4',  pcsPerBox:4},
  {id:6,  name:'Dimsum Topping 6 Pcs',           desc:'Dimsum Topping 6 pcs voil. Gratis pilih topping favorit.',                                   price:25000,  cat:'topping',  img:'gambar/07_topping_6pcs_voil.png',       badge:'',           tags:[], inStock:true, packaging:'Voil 6', pcsPerBox:6},
  {id:17, name:'Dimsum Topping 8 Pcs',           desc:'Dimsum Topping 8 pcs voil. Topping berlimpah, cocok untuk makan sendiri.',                   price:40000,  cat:'topping',  img:'gambar/07_topping_6pcs_voil.png',       badge:'',           tags:[], inStock:true, packaging:'Voil 8+Hard Box 8', pcsPerBox:8},
  {id:8,  name:'Dimsum Topping 10 Pcs',          desc:'Dimsum Topping 10 pcs voil. Topping berlimpah, cocok untuk mabar.',                          price:37000,  cat:'topping',  img:'gambar/08_topping_10pcs.png',           badge:'',           tags:['terlaris'], inStock:true, packaging:'Voil 8', pcsPerBox:10},
  {id:9,  name:'Dimsum Topping 16 Pcs',          desc:'Dimsum Topping 16 pcs voil. Topping berlimpah, cocok untuk mabar atau keluarga kecil.',      price:75000,  cat:'topping',  img:'gambar/09_topping_16pcs.png',           badge:'Favorit',    tags:['terlaris'], inStock:true, packaging:'Voil 16+Hard Box 16', pcsPerBox:16},
  {id:10, name:'Dimsum Topping 25 Pcs',          desc:'Dimsum Topping 25 pcs voil. Topping berlimpah, cocok untuk pesta & arisan.',                 price:110000, cat:'topping',  img:'gambar/10_topping_25pcs.png',           badge:'Best Value', tags:['terlaris'], inStock:true, packaging:'Voil 25+Hard Box 25', pcsPerBox:25},
  // ── DIMSUM GORENG ──
  // v123: Goreng — stok per PCS dari 'Dimsum Original', packaging kosong
  {id:18, name:'Dimsum Goreng Keju Lumer 3 Pcs', desc:'Dimsum Goreng 3 pcs topping Keju Lumer. Gurih, renyah, meleleh di mulut.',                   price:16000,  cat:'goreng',   img:'gambar/05_snackbox_4pcs.png',           badge:'',           tags:[], inStock:true, packaging:'',            pcsPerBox:3},
  {id:19, name:'Dimsum Goreng Mentai 3 Pcs',     desc:'Dimsum Goreng 3 pcs topping Mentai. Creamy dan gurih, cocok untuk pencinta mentai.',          price:25000,  cat:'goreng',   img:'gambar/06_topping_6pcs_dus.png',        badge:'',           tags:[], inStock:true, packaging:'',            pcsPerBox:3},
  {id:20, name:'Dimsum Goreng Mentai 9 Pcs',     desc:'Dimsum Goreng 9 pcs topping Mentai. Porsi besar, cocok untuk berbagi.',                      price:75000,  cat:'goreng',   img:'gambar/08_topping_10pcs.png',           badge:'Favorit',    tags:['terlaris'], inStock:true, packaging:'',            pcsPerBox:9},
  // ── DIMSUM ORIGINAL ──
  // v123: Original — stok per PCS dari 'Dimsum Original', packaging kosong (bukan kemasan)
  {id:11, name:'Dimsum Original 4 Pcs',          desc:'Dimsum Original 4 pcs. Rasa klasik tanpa topping, cocok untuk ngemil ringan.',               price:10000,  cat:'original', img:'gambar/05_snackbox_4pcs.png',           badge:'',           tags:[], inStock:true, packaging:'',            pcsPerBox:4},
  {id:12, name:'Dimsum Original 6 Pcs',          desc:'Dimsum Original 6 pcs. Dimsum polos otentik, gurih dan kenyal.',                             price:15000,  cat:'original', img:'gambar/06_topping_6pcs_dus.png',        badge:'',           tags:[], inStock:true, packaging:'',            pcsPerBox:6},
  {id:13, name:'Dimsum Original 10 Pcs',         desc:'Dimsum Original 10 pcs. Pas untuk makan sendiri atau berdua.',                               price:25000,  cat:'original', img:'gambar/08_topping_10pcs.png',           badge:'',           tags:[], inStock:true, packaging:'',            pcsPerBox:10},
  {id:14, name:'Dimsum Original 20 Pcs',         desc:'Dimsum Original 20 pcs. Cocok untuk arisan atau keluarga kecil.',                            price:48000,  cat:'original', img:'gambar/09_topping_16pcs.png',           badge:'',           tags:['terlaris'], inStock:true, packaging:'',            pcsPerBox:20},
  {id:15, name:'Dimsum Original 50 Pcs',         desc:'Dimsum Original 50 pcs. Pas untuk acara, pesta, & catering.',                               price:115000, cat:'original', img:'gambar/10_topping_25pcs.png',           badge:'Best Value', tags:['terlaris'], inStock:true, packaging:'',            pcsPerBox:50},
  {id:16, name:'Dimsum Original 100 Pcs',        desc:'Dimsum Original 100 pcs. Solusi catering, porsi berlimpah untuk acara besar.',               price:220000, cat:'original', img:'gambar/10_topping_25pcs.png',           badge:'Hemat',      tags:['terlaris'], inStock:true, packaging:'',            pcsPerBox:100},
  // ── BIRTHDAY ──
  {id:1,  name:'Birthday Tower 32 Pcs',          desc:'Dimsum Original susun tower — FREE Topper, Lilin & Chili Oil. Pemesanan H-3.',              price:140000, cat:'birthday', img:'gambar/01_birthday_tower_32pcs.png',     badge:'Spesial',    tags:['terlaris'], inStock:true, packaging:'Voil 25',     pcsPerBox:32},
  {id:2,  name:'Birthday Tower Topping 22 Pcs',  desc:'Dimsum Topping susun tower — FREE Topper, Lilin & Chili Oil. Pemesanan H-3.',               price:140000, cat:'birthday', img:'gambar/02_birthday_topping_22pcs.png',  badge:'Spesial',    tags:['terlaris'], inStock:true, packaging:'Voil 25',     pcsPerBox:22},
  {id:3,  name:'Birthday Dimsum Topping 25 Pcs', desc:'Dimsum Topping voil — FREE Topper, Lilin & Chili Oil. Pemesanan H-3.',                      price:115000, cat:'birthday', img:'gambar/03_birthday_25pcs_voil.png',     badge:'',           tags:[], inStock:true, packaging:'Voil 25',     pcsPerBox:25},
  {id:4,  name:'Birthday Dimsum Topping 8 Pcs',  desc:'Dimsum Topping 8 pcs — FREE Topper, Lilin & Chili Oil. Cocok untuk perayaan kecil.',       price:45000,  cat:'birthday', img:'gambar/04_birthday_topping_8pcs.png',   badge:'',           tags:[], inStock:true, packaging:'Voil 8',      pcsPerBox:8},
];
// menuData — runtime, akan diisi dari Supabase atau DEFAULT_MENU
const menuData=DEFAULT_MENU.map(function(m){return Object.assign({},m);});

const cabangData=[
  {id:'rp', name:'Rumah Produksi',        addr:'Kawasan Bojongsari, Depok',                    jam:'08.00–17.00',rating:5.0,wa:'6285133355583',open:true, lat:-6.4291444,lng:106.7420574,mapsUrl:'https://maps.app.goo.gl/D2PoQbyHYha8QJdL7',type:'produksi'},
  {id:'01', name:'Kampung Dimsum 01',     addr:'Bojongsari, Depok',                            jam:'08.00–21.00',rating:5.0,wa:'6288973547190',open:true, lat:-6.425067, lng:106.742754, mapsUrl:'https://maps.app.goo.gl/y8TCNQDcFbPRkgQLA',type:'cabang'},
  {id:'02', name:'Kampung Dimsum 02',     addr:'Bojongsari, Depok',                            jam:'08.00–21.00',rating:5.0,wa:'6285188332183',open:true, lat:-6.423313, lng:106.752438, mapsUrl:'https://maps.app.goo.gl/nigx4y1Ec33Htm4S9',type:'cabang'},
  {id:'03', name:'Kampung Dimsum 03',     addr:'Bojongsari, Depok',                            jam:'08.00–21.00',rating:5.0,wa:'6285188332185',open:true, lat:-6.4377371,lng:106.748122, mapsUrl:'https://maps.app.goo.gl/K5ZDFRuq7donepgv7',type:'cabang'},
  {id:'04', name:'Kampung Dimsum 04',     addr:'Bojongsari, Depok',                            jam:'08.00–21.00',rating:5.0,wa:'6285119992325',open:true, lat:-6.4278509,lng:106.7283324,mapsUrl:'https://maps.app.goo.gl/xvGBxsukXU3VCg6p6',type:'cabang'},
  {id:'05', name:'Kampung Dimsum 05',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'6285188332181',open:true, lat:-6.4336538,lng:106.7102726,mapsUrl:'https://maps.app.goo.gl/KX6jD6372LTVGDcq8',type:'cabang'},
  {id:'06', name:'Kampung Dimsum 06',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'6288985877717',open:true, lat:-6.436089, lng:106.705552, mapsUrl:'https://maps.app.goo.gl/tirVUHJgb3Ek87Cn6',type:'cabang'},
  {id:'07', name:'Kampung Dimsum 07',     addr:'Tajur Halang, Bogor',                          jam:'08.00–21.00',rating:5.0,wa:'6285188332182',open:true, lat:-6.4594488,lng:106.7402582,mapsUrl:'https://maps.app.goo.gl/jsqgqjcxbATYFdyg9',type:'cabang'},
  {id:'08', name:'Kampung Dimsum 08',     addr:'Depok',                                        jam:'08.00–21.00',rating:4.9,wa:'6288985877549',open:true, lat:-6.409775, lng:106.7552967,mapsUrl:'https://maps.app.goo.gl/oosdou815TLogdF5A',type:'cabang'},
  {id:'09', name:'Kampung Dimsum 09',     addr:'KP Perigi Tengah, Depok',                      jam:'08.00–21.00',rating:4.9,wa:'6285188332184',open:true, lat:-6.4312112,lng:106.758657, mapsUrl:'https://maps.app.goo.gl/B5f1Q2omnxsSpB23A',type:'cabang'},
  {id:'10', name:'Kampung Dimsum 10',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'62881024390401',open:true, lat:-6.4422012,lng:106.6945461,mapsUrl:'https://maps.app.goo.gl/EmUeyKseqiu39xSS9',type:'cabang'},
  {id:'11', name:'Kampung Dimsum 11',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'62881024390739',open:true, lat:-6.4202769,lng:106.7707015,mapsUrl:'https://maps.app.goo.gl/yxm4r9LwPaE1JdP46',type:'cabang'},
  {id:'12', name:'Kampung Dimsum 12',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'62881024389628',open:true, lat:-6.4038445,lng:106.7709108,mapsUrl:'https://maps.app.goo.gl/pNkmEPEq3BXi1p688',type:'cabang'},
  {id:'13', name:'Kampung Dimsum 13',     addr:'Depok (Agen)',                                 jam:'08.00–20.00',rating:5.0,wa:'6285178278059',open:true, lat:-6.4204614,lng:106.7673987,mapsUrl:'https://maps.app.goo.gl/uLSuMRTu2NRBWBPP6',type:'agen'},
  {id:'14', name:'Kampung Dimsum 14',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'62881024389830',open:true, lat:-6.4131307,lng:106.7703862,mapsUrl:'https://maps.app.goo.gl/6bc6my7Xe4zkQCCJ7',type:'cabang'},
  {id:'15', name:'Kampung Dimsum 15',     addr:'Depok',                                        jam:'08.00–21.00',rating:5.0,wa:'62881024389638',open:true, lat:-6.4220362,lng:106.7825628,mapsUrl:'https://maps.app.goo.gl/MCtqgf3pMuKnjkeX9',type:'cabang'},
];

// v82: promoData diambil dari Supabase (tabel: promos), localStorage hanya sebagai cache offline
// v117: tidak ada data dummy — fallback ke array kosong jika Supabase belum load
const _DEFAULT_PROMO = [];
let promoData=(function(){
  try{
    const saved=localStorage.getItem('kd_promoData');
    if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed)&&parsed.length){
      // Pastikan semua item punya field active (migrasi dari versi lama)
      parsed.forEach(p=>{ if(p.active===undefined) p.active=true; });
      return parsed;
    }}
  }catch(e){}
  return [];
})();
function _persistPromo(){try{localStorage.setItem('kd_promoData',JSON.stringify(promoData));}catch(e){}}

// ── SUPABASE PROMO HELPERS v82 ──
// SQL untuk buat tabel (jalankan sekali di Supabase SQL Editor):
// CREATE TABLE IF NOT EXISTS promos (
//   id BIGSERIAL PRIMARY KEY,
//   tag TEXT NOT NULL,
//   title TEXT NOT NULL,
//   description TEXT DEFAULT '-',
//   expire TEXT DEFAULT '-',
//   color TEXT DEFAULT 'linear-gradient(135deg,#7B1A1A,#2C0A0A)',
//   active BOOLEAN DEFAULT TRUE,
//   sort_order INT DEFAULT 0,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   updated_at TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin_all" ON promos FOR ALL USING (auth.role()='authenticated');
// CREATE POLICY "public_read" ON promos FOR SELECT USING (true);

async function loadPromoFromSupabase(){
  const sb = getSB(); if(!sb) return;
  try{
    const { data, error } = await sb.from('promos').select('*').order('sort_order').order('id');
    if(error){ console.warn('[Promo] Supabase load error:', error.message); return; }
    if(data && data.length){
      promoData = data.map(r=>({
        id: r.id,
        tag: r.tag,
        title: r.title,
        desc: r.description,
        expire: r.expire,
        color: r.color,
        active: r.active !== false,
        sort_order: r.sort_order || 0
      }));
      _persistPromo();
      renderPromo();
      renderAdminTables();
    }
  }catch(e){ console.warn('[Promo] loadPromoFromSupabase exception:', e); }
}

async function _savePromoToSupabase(obj, existingId){
  const sb = getSB(); if(!sb) return null;
  const row = {
    tag: obj.tag, title: obj.title, description: obj.desc,
    expire: obj.expire, color: obj.color,
    active: obj.active !== false,
    sort_order: obj.sort_order || 0,
    updated_at: new Date().toISOString()
  };
  try{
    if(existingId){
      const { data, error } = await sb.from('promos').update(row).eq('id', existingId).select().single();
      if(error){ showToast('Gagal sync ke database: '+error.message,'error'); return null; }
      return data;
    } else {
      row.created_at = new Date().toISOString();
      const { data, error } = await sb.from('promos').insert(row).select().single();
      if(error){ showToast('Gagal sync ke database: '+error.message,'error'); return null; }
      return data;
    }
  }catch(e){ showToast('Error database: '+e.message,'error'); return null; }
}

async function _deletePromoFromSupabase(id){
  const sb = getSB(); if(!sb || !id) return;
  try{
    const { error } = await sb.from('promos').delete().eq('id', id);
    if(error) showToast('Gagal hapus dari database: '+error.message,'error');
  }catch(e){ showToast('Error database: '+e.message,'error'); }
}

async function togglePromoActive(idx){
  const p = promoData[idx];
  if(!p) return;
  const newState = !p.active;
  p.active = newState;
  renderAdminTables();
  renderPromo();
  _persistPromo();
  if(p.id){
    const sb = getSB();
    if(sb){
      try{
        const { error } = await sb.from('promos').update({ active: newState, updated_at: new Date().toISOString() }).eq('id', p.id);
        if(error){ showToast('Gagal update status: '+error.message,'error'); p.active=!newState; renderAdminTables(); renderPromo(); _persistPromo(); return; }
      }catch(e){ showToast('Error: '+e.message,'error'); return; }
    }
  }
  showToast(newState ? '✅ Promo diaktifkan' : '⏸ Promo dinonaktifkan', newState?'success':'error');
}

// v125: fallback testimonials hardcode agar section tidak blank jika DB belum ada kolom testimoni
// Kolom DB yang dibutuhkan: approved(bool), komentar(text), rating(int), cabang(text)
// SQL Migration (jalankan sekali): ALTER TABLE feedback ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
//   ALTER TABLE feedback ADD COLUMN IF NOT EXISTS komentar TEXT DEFAULT '';
//   ALTER TABLE feedback ADD COLUMN IF NOT EXISTS rating INT DEFAULT 5;
//   ALTER TABLE feedback ADD COLUMN IF NOT EXISTS cabang TEXT DEFAULT '';
// Atau buat tabel terpisah: CREATE TABLE testimonials (...) dan update query di _loadPublicData.
const testimonials=[
  {text:'Dimsum-nya enak banget, topping berlimpah dan harganya terjangkau. Favorit keluarga kami!', name:'Budi Santoso', loc:'Bojongsari, Depok', stars:5, init:'BS'},
  {text:'Pesan via WhatsApp cepat direspon, dimsum datang masih panas dan fresh. Recommended!', name:'Siti Rahayu', loc:'Depok', stars:5, init:'SR'},
  {text:'Sudah langganan dari cabang 01, sekarang ada cabang baru dekat rumah. Mantap!', name:'Andi Pratama', loc:'Tajur Halang, Bogor', stars:5, init:'AP'},
  {text:'Birthday tower-nya keren, anakku suka banget. Pasti order lagi untuk ulang tahun berikutnya.', name:'Dewi Lestari', loc:'Depok', stars:5, init:'DL'},
  {text:'Kualitas konsisten di semua cabang. Dimsum original-nya juara, bumbu meresap sempurna.', name:'Rizky Firmansyah', loc:'Bojongsari, Depok', stars:5, init:'RF'},
  {text:'Harga bersahabat, porsi banyak, dan pelayanan ramah. Tidak mengecewakan sama sekali!', name:'Maya Kusuma', loc:'Depok', stars:5, init:'MK'},
];

const faqData=[
  {q:'Apakah Kampung Dimsum menggunakan bahan halal?',a:'Ya, seluruh produk kami menggunakan bahan halal dan tersertifikasi. Kami berkomitmen agar setiap pelanggan dapat menikmati produk kami dengan nyaman.'},
  {q:'Apakah bisa melakukan pre-order atau reservasi?',a:'Saat ini kami melayani pre-order melalui WhatsApp masing-masing cabang. Untuk pemesanan besar (catering), hubungi minimal 1 hari sebelumnya.'},
  {q:'Bagaimana cara melacak status pesanan saya?',a:'Klik ikon paket (📦) di navbar atas, masukkan nomor pesanan Anda (format: KD-YYYYMMDD-NNN) untuk melihat status terkini — Pending, Diproses, atau Siap Diambil.'},
  {q:'Berapa minimal pemesanan untuk catering/acara?',a:'Minimal 50 pcs. Untuk detail harga dan paket khusus acara, hubungi kami di WhatsApp pusat atau email halo@kampungdimsum.com.'},
  {q:'Apakah ada layanan delivery?',a:'Tersedia melalui GoFood dan GrabFood di sebagian besar cabang. Radius mengikuti ketentuan masing-masing platform.'},
  {q:'Bagaimana cara mendaftar sebagai mitra franchise?',a:'Isi formulir di halaman Franchise, atau hubungi langsung tim franchise kami. Kami akan menghubungi dalam 2–3 hari kerja.'},
  {q:'Bagaimana cara bergabung program Member Rewards?',a:'Klik "Jadi Member" di halaman utama atau tombol Member di navigasi. Pendaftaran gratis dan poin langsung aktif di transaksi pertama.'}
];

// omsetHistory — diisi dari Supabase setelah login. Tidak ada data dummy.
// localStorage hanya digunakan sebagai cache sementara setelah load dari Supabase.
const omsetHistory=(function(){
  try{
    const saved=localStorage.getItem('kd_omsetHistory');
    if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed)&&parsed.length)return parsed;}
  }catch(e){}
  return []; // Kosong — _sbLoadAll() akan isi dari Supabase setelah login
})();
function _persistOmset(){try{localStorage.setItem('kd_omsetHistory',JSON.stringify(omsetHistory));}catch(e){}}

// franchiseApplicants — diisi dari Supabase via _sbLoadAll() → window._franchiseApplicants
// Tidak ada data dummy. Fallback ke array kosong jika DB belum diload.
let franchiseApplicants = [];

// feedbackList — diisi dari Supabase via _sbLoadAll() → window._feedbackList
// Tidak ada data dummy.
let feedbackList = [];

// ordersData — diisi dari Supabase tabel 'penjualan' via _sbLoadAll()
// Tidak ada data dummy.
let ordersData = [];

// BUG FIX: adminUsers tidak lagi hardcoded — di-load live dari Supabase admin_profiles
// loadAdminUsers() dipanggil setiap kali panel user-mgmt dibuka
let adminUsers = [];

async function loadAdminUsers(){
  const grid = document.getElementById('user-roles-grid');
  if(grid) grid.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text3);font-size:.85rem">Memuat data akun…</div>';
  const sb = getSB();
  if(!sb){ if(grid) grid.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red);font-size:.85rem">Gagal terhubung ke server</div>'; return; }
  // Ambil semua baris tanpa filter active agar superadmin bisa lihat semua akun
  const { data, error } = await sb.from('admin_profiles').select('*').order('role').order('display_name');
  if(error || !data){ if(grid) grid.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red);font-size:.85rem">Gagal memuat: ' + (error&&error.message||'unknown') + '</div>'; return; }
  // Mapping kolom Supabase ke format lokal yang dipakai renderUserMgmt()
  adminUsers = data.map(function(p){
    var name = p.display_name || p.username || '—';
    var initial = name.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase() || '??';
    // v87 FIX: pakai _mergePerms (single source of truth)
    var perms = _mergePerms(p.permissions, p.role);
    return { id:p.id, user_id:p.user_id, name:name, username:p.username||'—', initial:initial, role:p.role||'staff', cabang:p.cabang_name||p.cabang||'—', perms:perms, active:p.active!==false };
  });
  renderUserMgmt();
}

// activityLog — diisi dari Supabase tabel 'activity_logs' via _sbLoadAll()
// Tidak ada data dummy.
const activityLog = [];


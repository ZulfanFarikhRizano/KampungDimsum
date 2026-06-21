/* ===== Katalog Tab Switcher ===== */
function katalogSwitchTab(tab){
  ['menu','banner','priceboard'].forEach(function(t){
    var panel = document.getElementById('kpanel-'+t);
    var btn = document.getElementById('ktab-'+t);
    if(panel) panel.style.display = t===tab ? '' : 'none';
    if(btn){
      btn.style.borderBottomColor = t===tab ? 'var(--red)' : 'transparent';
      btn.style.color = t===tab ? 'var(--red)' : 'var(--text3)';
      btn.style.fontWeight = t===tab ? '700' : '600';
    }
  });
  if(tab==='banner') bannerRenderAll();
}

/* ===== Banner Data Management ===== */
// Storage key
var BANNER_KEY_HERO = 'kd_bannerHero';
var BANNER_KEY_MENU = 'kd_bannerMenu';

// Default banners (sesuai file yang sudah ada di gambar/)
var DEFAULT_HERO_BANNERS = [
  { id: 1, url: 'gambar/banner-card1.png', alt: 'Kampung Dimsum Banner 1', order: 1 },
  { id: 2, url: 'gambar/banner-card2.png', alt: 'Kampung Dimsum Banner 2', order: 2 },
  { id: 3, url: 'gambar/banner-card3.png', alt: 'Kampung Dimsum Banner 3', order: 3 },
];
var DEFAULT_MENU_BANNERS = [
  { id: 1, url: 'gambar/banner1.png', alt: 'Menu Dimsum Topping', order: 1 },
  { id: 2, url: 'gambar/banner2.png', alt: 'Menu Dimsum Birthday', order: 2 },
];

function _getBanners(type){
  try {
    var key = type==='hero' ? BANNER_KEY_HERO : BANNER_KEY_MENU;
    var raw = localStorage.getItem(key);
    if(raw) return JSON.parse(raw);
  } catch(e){}
  return type==='hero' ? DEFAULT_HERO_BANNERS.map(function(b){return Object.assign({},b);}) : DEFAULT_MENU_BANNERS.map(function(b){return Object.assign({},b);});
}

function _saveBanners(type, data){
  try {
    var key = type==='hero' ? BANNER_KEY_HERO : BANNER_KEY_MENU;
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e){}
}

function bannerRenderAll(){
  bannerRenderList('hero');
  bannerRenderList('menubanner');
  // Juga update tampilan publik
  bannerApplyToPublic();
}

function bannerRenderList(type){
  var isHero = type==='hero';
  var data = _getBanners(isHero ? 'hero' : 'menu');
  data.sort(function(a,b){ return (a.order||1)-(b.order||1); });

  var listId = isHero ? 'hero-banner-list' : 'menu-banner-list';
  var countId = isHero ? 'hero-banner-count' : 'menu-banner-count';
  var list = document.getElementById(listId);
  var countEl = document.getElementById(countId);
  if(!list) return;
  if(countEl) countEl.textContent = data.length;

  if(!data.length){
    list.innerHTML = '<div style="text-align:center;color:var(--text4);font-size:.8rem;padding:16px;border:1.5px dashed var(--border2);border-radius:9px">Belum ada banner — klik tombol Tambah di bawah</div>';
    return;
  }

  list.innerHTML = data.map(function(b, idx){
    return '<div style="display:flex;align-items:center;gap:12px;background:var(--bg2);border:1.5px solid var(--border2);border-radius:10px;padding:10px 12px">'
      +'<div style="width:90px;height:54px;flex-shrink:0;border-radius:7px;overflow:hidden;background:var(--bg3,var(--bg))">'
      +'<img src="'+_esc(b.url)+'" alt="'+_esc(b.alt)+'" style="width:100%;height:100%;object-fit:cover" onerror="this.src=\'\'"></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.8rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(b.alt||'Banner '+(idx+1))+'</div>'
      +'<div style="font-size:.72rem;color:var(--text4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(b.url)+'</div>'
      +'<div style="font-size:.7rem;color:var(--text4);margin-top:2px">Urutan: <strong>'+b.order+'</strong></div>'
      +'</div>'
      +'<div style="display:flex;gap:6px;flex-shrink:0">'
      +'<button class="btn-edit" onclick="bannerOpenModal('+idx+',\''+type+'\')" style="font-size:.72rem;padding:5px 10px">Edit</button>'
      +'<button class="btn-danger" onclick="bannerDelete('+idx+',\''+type+'\')" style="font-size:.72rem;padding:5px 10px">Hapus</button>'
      +'</div></div>';
  }).join('');
}

function bannerOpenModal(idx, type){
  var overlay = document.getElementById('banner-modal-overlay');
  var titleEl = document.getElementById('banner-modal-title');
  var typeSel = document.getElementById('banner-type-sel');
  var imgUrl = document.getElementById('banner-img-url');
  var altEl = document.getElementById('banner-alt');
  var orderEl = document.getElementById('banner-order');
  var idxEl = document.getElementById('banner-edit-idx');
  var typeEl = document.getElementById('banner-edit-type');

  var isHero = type==='hero';
  var data = _getBanners(isHero ? 'hero' : 'menu');

  idxEl.value = idx;
  typeEl.value = type;
  typeSel.value = isHero ? 'hero' : 'menubanner';
  bannerTypeChange(typeSel.value);

  // Reset state upload gambar setiap buka modal
  window._bannerImgBase64 = null;
  window._bannerImgFilename = null;
  var thumbImg  = document.getElementById('banner-img-thumb-img');
  var thumbIcon = document.getElementById('banner-img-thumb-icon');
  if(thumbImg)  { thumbImg.src = ''; thumbImg.style.display = 'none'; }
  if(thumbIcon) thumbIcon.style.display = '';
  var fileInput = document.getElementById('banner-file-input');
  if(fileInput) fileInput.value = '';

  if(idx >= 0 && data[idx]){
    var b = data[idx];
    titleEl.textContent = 'Edit Banner';
    imgUrl.value = b.url || '';
    altEl.value = b.alt || '';
    orderEl.value = b.order || (idx+1);
    bannerPreview(b.url);
  } else {
    titleEl.textContent = 'Tambah Banner';
    imgUrl.value = '';
    altEl.value = '';
    orderEl.value = data.length + 1;
    bannerPreview('');
  }

  // FIX v119 #5 (KRITIS): CSS .um-modal-overlay pakai opacity:0;pointer-events:none
  // — harus tambah class 'show' agar modal muncul dan bisa diklik
  overlay.style.display = 'flex';
  requestAnimationFrame(function(){ overlay.classList.add('show'); });
}

function bannerCloseModal(){
  var overlay = document.getElementById('banner-modal-overlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  setTimeout(function(){ overlay.style.display = 'none'; }, 300);
}

function bannerTypeChange(val){
  // No extra fields needed — kept for future extensibility
}

// Upload handler untuk banner — sama validasi berlapis dengan katalog
function bannerHandleFileUpload(input){
  var file = input.files && input.files[0];
  if(!file) return;
  // Layer 1: ekstensi
  var _ext = (file.name.split('.').pop()||'').toLowerCase();
  var _exts = ['jpg','jpeg','png','gif','webp','heic','heif','avif','bmp','tiff','tif'];
  if(!_exts.includes(_ext)){ showToast('Format tidak didukung. Gunakan: JPG, PNG, WEBP','error'); input.value=''; return; }
  // Layer 2: MIME
  var _mimes = ['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif','image/avif','image/bmp','image/tiff','image/x-tiff'];
  if(file.type && !_mimes.includes(file.type.toLowerCase())){ showToast('Tipe file tidak valid.','error'); input.value=''; return; }
  // Layer 3: ukuran
  if(file.size > 2*1024*1024){ showToast('Ukuran file melebihi 2MB. Kompress dulu ya!','error'); input.value=''; return; }
  // Layer 4: magic bytes
  var headReader = new FileReader();
  headReader.onload = function(ev){
    var arr = new Uint8Array(ev.target.result);
    var valid = (
      (arr[0]===0xFF&&arr[1]===0xD8&&arr[2]===0xFF) ||                                     // JPEG
      (arr[0]===0x89&&arr[1]===0x50&&arr[2]===0x4E&&arr[3]===0x47) ||                      // PNG
      (arr[0]===0x47&&arr[1]===0x49&&arr[2]===0x46&&arr[3]===0x38) ||                      // GIF
      (arr[0]===0x52&&arr[1]===0x49&&arr[2]===0x46&&arr[3]===0x46&&arr[8]===0x57&&arr[9]===0x45&&arr[10]===0x42&&arr[11]===0x50) || // WEBP
      (arr[0]===0x42&&arr[1]===0x4D) ||                                                    // BMP
      (arr[4]===0x66&&arr[5]===0x74&&arr[6]===0x79&&arr[7]===0x70)                         // HEIC/AVIF
    );
    if(!valid){ showToast('File bukan gambar valid. Upload dibatalkan.','error'); input.value=''; return; }
    // Semua lolos — baca base64
    var reader = new FileReader();
    reader.onload = function(e){
      window._bannerImgBase64 = e.target.result;
      window._bannerImgFilename = file.name;
      // Update thumbnail
      var thumbImg  = document.getElementById('banner-img-thumb-img');
      var thumbIcon = document.getElementById('banner-img-thumb-icon');
      if(thumbImg){ thumbImg.src=e.target.result; thumbImg.style.display='block'; }
      if(thumbIcon) thumbIcon.style.display='none';
      // Update preview besar juga
      var wrap = document.getElementById('banner-preview-wrap');
      var prevImg = document.getElementById('banner-preview-img');
      if(prevImg){ prevImg.src=e.target.result; prevImg.style.display='block'; }
      if(wrap) wrap.style.display='block';
      // Kosongkan URL field
      var urlField = document.getElementById('banner-img-url');
      if(urlField) urlField.value='';
      showToast('Foto dipilih: '+file.name,'success');
    };
    reader.readAsDataURL(file);
  };
  headReader.readAsArrayBuffer(file.slice(0,12));
}

function bannerPreview(url){
  var wrap = document.getElementById('banner-preview-wrap');
  var img  = document.getElementById('banner-preview-img');
  // Update thumbnail di atas juga
  var thumbImg  = document.getElementById('banner-img-thumb-img');
  var thumbIcon = document.getElementById('banner-img-thumb-icon');
  if(!url){
    if(wrap) wrap.style.display='none';
    if(thumbImg){ thumbImg.src=''; thumbImg.style.display='none'; }
    if(thumbIcon) thumbIcon.style.display='';
    return;
  }
  if(img){ img.src = url; img.style.display='block'; }
  if(wrap) wrap.style.display='block';
  if(thumbImg){ thumbImg.src=url; thumbImg.style.display='block'; }
  if(thumbIcon) thumbIcon.style.display='none';
}
// Alias untuk oninput URL field (URL diutamakan, clear base64)
function bannerPreviewUrl(url){
  if(url){ window._bannerImgBase64=null; window._bannerImgFilename=null; }
  bannerPreview(url);
}

async function bannerSaveModal(){
  var idx = parseInt(document.getElementById('banner-edit-idx').value);
  var typeVal = document.getElementById('banner-edit-type').value;
  var typeSel = document.getElementById('banner-type-sel').value;
  var urlField = document.getElementById('banner-img-url').value.trim();
  var alt = document.getElementById('banner-alt').value.trim();
  var order = parseInt(document.getElementById('banner-order').value) || 1;

  // Tentukan URL final: prioritas upload file, fallback ke URL field
  var url = urlField;
  if(window._bannerImgBase64){
    var saveBtn = document.querySelector('#banner-modal-overlay .btn-save');
    if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Mengupload...'; }
    try {
      url = await _katalogUploadImage(window._bannerImgBase64, window._bannerImgFilename || 'banner.jpg');
    } catch(e){ url = window._bannerImgBase64; } // fallback base64 jika upload gagal
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='Simpan Banner'; }
  }

  if(!url){ showToast('Pilih gambar atau masukkan URL!','error'); return; }

  // typeSel bisa berubah, ikuti typeSel
  var actualType = typeSel === 'hero' ? 'hero' : 'menu';
  var data = _getBanners(actualType);

  if(idx >= 0 && data[idx]){
    data[idx] = Object.assign(data[idx], { url, alt, order });
    showToast('Banner diperbarui!','success');
  } else {
    var newId = Date.now();
    data.push({ id: newId, url, alt, order });
    showToast('Banner ditambahkan!','success');
  }

  data.sort(function(a,b){ return (a.order||1)-(b.order||1); });
  _saveBanners(actualType, data);
  bannerCloseModal();
  bannerRenderAll();
}

function bannerDelete(idx, type){
  var isHero = type==='hero';
  var actualType = isHero ? 'hero' : 'menu';
  var data = _getBanners(actualType);
  if(!data[idx]) return;
  // v124 FIX KRITIS-02: ganti confirm() native → custom SA confirm dialog
  // confirm() native bisa diblokir browser mobile modern → hapus tidak jalan
  var label = 'Banner "' + (data[idx].alt||'tanpa judul') + '" (urutan ' + (data[idx].order||1) + ')';
  _saDeletePending = { type: 'banner', idx: idx, label: label, bannerType: actualType, bannerIdx: idx };
  var warn = document.getElementById('sa-delete-warn');
  var info = document.getElementById('sa-delete-info');
  if(warn) warn.textContent = 'Anda akan menghapus banner ini secara permanen dari slideshow.';
  if(info) info.innerHTML = '<strong>Data:</strong> ' + label;
  var overlay = document.getElementById('sa-delete-overlay');
  if(overlay) overlay.classList.add('show');
}

function bannerApplyToPublic(){
  // Update hero slider DOM
  var heroBanners = _getBanners('hero');
  heroBanners.sort(function(a,b){ return (a.order||1)-(b.order||1); });
  var track = document.getElementById('heroBannerTrack');
  var dotsWrap = document.getElementById('heroBannerDots');

  if(track && heroBanners.length){
    track.innerHTML = heroBanners.map(function(b){
      return '<div class="hero-banner-slide"><img src="'+_esc(b.url)+'" alt="'+_esc(b.alt)+'" loading="lazy" onerror="this.closest(\'.hero-banner-slide\').style.display=\'none\'"></div>';
    }).join('');
    if(dotsWrap){
      dotsWrap.innerHTML = heroBanners.map(function(b,i){
        return '<button class="hero-banner-dot'+(i===0?' active':'')+'" data-idx="'+i+'" aria-label="Slide '+(i+1)+'"></button>';
      }).join('');
      // re-attach dot click
      dotsWrap.querySelectorAll('.hero-banner-dot').forEach(function(d){
        d.addEventListener('click', function(){ window.heroBannerGoTo && window.heroBannerGoTo(parseInt(d.getAttribute('data-idx'),10)); });
      });
    }
    // Update counter in hero banner IIFE
    if(window._heroBannerSetTotal) window._heroBannerSetTotal(heroBanners.length);
    // Trigger reset via goTo(0)
    if(window.heroBannerGoTo) window.heroBannerGoTo(0);
  }

  // Update menu banners DOM (public section)
  var menuBanners = _getBanners('menu');
  menuBanners.sort(function(a,b){ return (a.order||1)-(b.order||1); });
  var menuBannersEl = document.getElementById('menu-banners');
  if(menuBannersEl && menuBanners.length){
    menuBannersEl.innerHTML = menuBanners.map(function(b){
      return '<div class="menu-banner-img"><img src="'+_esc(b.url)+'" alt="'+_esc(b.alt)+'" width="800" height="400" loading="lazy" onerror="this.closest(\'.menu-banner-img\').style.display=\'none\'"></div>';
    }).join('');
  }
}

// Auto-apply on page load
document.addEventListener('DOMContentLoaded', function(){
  bannerApplyToPublic();
});

/* ===== Hero Banner Slideshow ===== */
(function(){
  var idx=0, total=3, timer=null, INTERVAL=4500, paused=false;
  window._heroBannerSetTotal=function(n){ total=n; if(idx>=total) idx=0; update(); };

  function update(){
    // ganti pendekatan: pakai active-slide class, bukan translateX
    var slides=document.querySelectorAll('.hero-banner-slide');
    slides.forEach(function(s,i){
      s.classList.toggle('active-slide', i===idx);
    });
    // update dots
    var dots=document.querySelectorAll('.hero-banner-dot');
    dots.forEach(function(d){
      d.classList.remove('active');
      void d.offsetWidth;
    });
    var activeDot=dots[idx];
    if(activeDot){
      activeDot.style.setProperty('--dot-duration', INTERVAL+'ms');
      activeDot.classList.add('active');
    }
  }

  function move(dir){
    idx=(idx+dir+total)%total;
    update();
    if(!paused) resetTimer();
  }

  window.heroBannerMove=move;
  window.heroBannerGoTo=function(i){ idx=i; update(); if(!paused) resetTimer(); };

  function resetTimer(){
    clearInterval(timer);
    timer=setInterval(function(){ move(1); }, INTERVAL);
  }

  document.addEventListener('DOMContentLoaded',function(){
    // init slide pertama
    update();
    resetTimer();

    // dot click
    document.querySelectorAll('.hero-banner-dot').forEach(function(d){
      d.addEventListener('click',function(){
        window.heroBannerGoTo(parseInt(d.getAttribute('data-idx'),10));
      });
    });

    // swipe + pause on hover
    var wrap=document.querySelector('.hero-banner-wrap');
    if(wrap){
      var startX=0;
      wrap.addEventListener('mouseenter',function(){ paused=true; clearInterval(timer); });
      wrap.addEventListener('mouseleave',function(){ paused=false; resetTimer(); });
      wrap.addEventListener('touchstart',function(e){ startX=e.touches[0].clientX; },{passive:true});
      wrap.addEventListener('touchend',function(e){
        var diff=startX-e.changedTouches[0].clientX;
        if(Math.abs(diff)>40) move(diff>0?1:-1);
      },{passive:true});
    }
  });
})();

// ============ TOAST ============
let toastTimeout;
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  const icons={success:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#10B981"/><path d="M8 12l3 3 5-6" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',error:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#EF4444"/><path d="M15 9l-6 6M9 9l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>',info:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;width:1em;height:1em" ><circle cx="12" cy="12" r="10" fill="#3B82F6"/><path d="M12 8v4M12 16v.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>'};
  t.innerHTML=(icons[type]||'')+(icons[type]?'<span style="display:inline-block;width:1px"></span> ':'')+msg;
  t.className='toast '+type;
  clearTimeout(toastTimeout);
  setTimeout(()=>t.classList.add('show'),10);
  toastTimeout=setTimeout(()=>t.classList.remove('show'),3500);
}

// ============ HAMBURGER / DRAWER ============
function toggleDrawer(){
  const d=document.getElementById('nav-drawer');
  d.classList.toggle('open');
}
function closeDrawer(){
  document.getElementById('nav-drawer').classList.remove('open');
}
// RESIZE: debounced + rAF-gated to avoid thrashing on every pixel of drag
// BEFORE: checkMobileNav fires synchronously on every resize event (many per second)
// AFTER: debounced 150ms + rAF; also refreshes layout caches for scroll engine
function checkMobileNav(){
  const isMobile=window.innerWidth<=768;
  const mbt=document.getElementById('mobile-theme-toggle');
  const mbb=document.getElementById('mobile-bell');
  if(mbt)mbt.style.display=isMobile?'flex':'none';
  if(mbb)mbb.style.display=isMobile?'flex':'none';
}
var _resizeTimer;
window.addEventListener('resize', function(){
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function(){
    requestAnimationFrame(function(){
      checkMobileNav();
      // Refresh scrollDocH (used by unified scroll engine for progress bar)
      window._scrollDocHGlobal = document.documentElement.scrollHeight - window.innerHeight;
      // FIX v71: invalidate sectionTopCache agar parallax tidak pakai posisi lama setelah resize
      if(window._sectionTopCacheRef) window._sectionTopCacheRef.clear();
      // FIX v71: re-compute heroH setelah resize
      if(window._readStableLayoutRef) window._readStableLayoutRef();
    });
  }, 150);
}, {passive: true});
checkMobileNav();

// ============ UNIFIED SCROLL ENGINE (PERF v11) ============
// BEFORE: 5 separate scroll listeners each calling rAF independently → up to 5x rAF callbacks/frame
// AFTER: 1 passive listener, 1 rAF gate, all scroll work batched in one frame callback
// Impact: eliminates redundant frame scheduling, halves main-thread scroll cost on mobile
(function(){
  // ── Cache DOM refs once (no per-frame querySelector) ──
  var pfMain  = document.getElementById('pf-main');
  var pf1     = document.getElementById('pf-1');
  var pf2     = document.getElementById('pf-2');
  var pf3     = document.getElementById('pf-3');
  var pf4     = document.getElementById('pf-4');
  var pf5     = document.getElementById('pf-5');
  var pf6     = document.getElementById('pf-6');
  var hero    = document.getElementById('hero');
  var mainNav = document.getElementById('main-nav');
  var progressBar = document.getElementById('scroll-progress-bar');
  var dimsumFixed = document.getElementById('dimsum-fixed');
  var pbgAbout    = document.getElementById('pbg-about');
  var pbgMenu     = document.getElementById('pbg-menu');
  var pbgPromo    = document.getElementById('pbg-promo');
  var pbgTesti    = document.getElementById('pbg-testi');
  var pbgLoyalty  = document.getElementById('pbg-loyalty');
  var pbgFranchise= document.getElementById('pbg-franchise');

  // ── Pre-compute stable layout values ONCE (batch read, no per-frame thrash) ──
  // BEFORE: hero.offsetHeight read inside every scroll frame (forces layout)
  // AFTER: read once on load + on resize only → zero per-frame layout reads
  var heroH = window.innerHeight;
  var dimsumRotation = 0;
  var dimsumLastSY   = 0;

  function readStableLayout(){
    heroH = (hero && hero.offsetHeight > 100) ? hero.offsetHeight : window.innerHeight;
  }
  readStableLayout();
  // FIX v71: expose ke window agar resize handler bisa invalidate
  window._sectionTopCacheRef  = sectionTopCache;
  window._readStableLayoutRef = readStableLayout;

  // Helper: pre-compute offsetTop chain ONCE per element (not per scroll)
  // BEFORE: getOffsetTop() traversed offsetParent chain every frame (expensive)
  // AFTER: computed once, cached in a Map
  var sectionTopCache = new Map();
  function getCachedSectionTop(el){
    if(!el) return 0;
    if(sectionTopCache.has(el)) return sectionTopCache.get(el);
    var top = 0, node = el;
    while(node){ top += node.offsetTop; node = node.offsetParent; }
    sectionTopCache.set(el, top);
    return top;
  }

  // ── Single rAF gate for ALL scroll work ──
  var scrollTicking = false;
  var currentSY     = 0;

  // PERF v35: skip parallax & spinner di low-end — hemat ~60% scroll thread cost
  // _isDesktop: sudah ada, tapi low-end mobile tetap skip meskipun "desktop"
  var _isDesktop = window.innerWidth >= 768 && !window._KD_LOW;
  window.addEventListener('resize', function(){ _isDesktop = window.innerWidth >= 768 && !window._KD_LOW; }, {passive:true});

  function runAllScrollWork(){
    var sy = currentSY;

    // --- 1. Parallax hero food items (desktop only) ---
    if(_isDesktop && pfMain && sy <= heroH * 1.2){
      var mainY       = -(sy * 0.28);
      var mainScale   = 1 - Math.min(sy / heroH, 1) * 0.22;
      var mainOpacity = 1 - Math.min(sy / heroH, 1) * 0.6;
      pfMain.style.transform = 'translateY('+mainY+'px) scale('+mainScale+')';
      pfMain.style.opacity   = mainOpacity.toFixed(3);
      if(pf1) pf1.style.transform = 'translateY('+(-sy*0.5)+'px)';
      if(pf2) pf2.style.transform = 'translateY('+(-sy*0.65)+'px)';
      if(pf3) pf3.style.transform = 'translateY('+(-sy*0.42)+'px)';
      if(pf4) pf4.style.transform = 'translateY('+(-sy*0.58)+'px)';
      if(pf5) pf5.style.transform = 'translateY('+(-sy*0.35)+'px)';
      if(pf6) pf6.style.transform = 'translateY('+(-sy*0.7)+'px)';
    }

    // --- 2. Nav scrolled class ---
    if(mainNav) mainNav.classList.toggle('scrolled', sy > 40);

    // --- 3. Scroll progress bar ---
    // BEFORE: read scrollHeight + innerHeight inside scroll handler (layout thrash)
    // AFTER: scrollHeight cached; only re-read on resize
    if(progressBar){
      var pct = (window._scrollDocHGlobal || _scrollDocH) > 0 ? (sy / (window._scrollDocHGlobal || _scrollDocH)) * 100 : 0;
      // BEFORE: bar.style.width = pct+'%' (triggers layout for width)
      // AFTER: scaleX transform — GPU-composited, zero layout
      progressBar.style.transform = 'scaleX('+(pct/100)+')';
    }

    // --- 4. Dimsum fixed spinner — skip di low-end ---
    if(dimsumFixed && !window._KD_LOW){
      var adminDash = document.getElementById('page-admin-dash');
      if(adminDash && adminDash.classList.contains('active')){
        dimsumFixed.style.opacity = '0';
        dimsumFixed.classList.remove('animating');
      } else {
        dimsumFixed.classList.add('animating');
        dimsumRotation += (sy - dimsumLastSY) * 0.45;
        dimsumLastSY = sy;
        var fadeStart = heroH * 0.6, fadeEnd = heroH;
        var dfOpacity = sy <= fadeStart ? 1 : sy >= fadeEnd ? 0
                      : 1 - (sy - fadeStart) / (fadeEnd - fadeStart);
        dimsumFixed.style.opacity   = dfOpacity.toFixed(3);
        dimsumFixed.style.transform = 'translateY(calc(-50% + '+(-(sy*0.06)).toFixed(1)+'px)) rotate('+dimsumRotation.toFixed(1)+'deg)';
      }
    }

    // --- 5. Parallax background text (pbg-*) — skip di low-end ---
    if(!window._KD_LOW){
    function applyBgEl(el, factor){
      if(!el) return;
      var sectionTop = getCachedSectionTop(el.parentElement || el);
      var rel = sy - sectionTop + window.innerHeight;
      el.style.transform = 'translateY('+(rel*factor)+'px)';
    }
    applyBgEl(pbgAbout,    -0.08);
    applyBgEl(pbgMenu,      0.06);
    applyBgEl(pbgPromo,    -0.07);
    applyBgEl(pbgTesti,     0.05);
    applyBgEl(pbgLoyalty,  -0.06);
    applyBgEl(pbgFranchise, 0.07);
    } // end !_KD_LOW parallax block

    scrollTicking = false;
  }

  // ── Cached document height (batch read, updated on resize) ──
  var _scrollDocH = document.documentElement.scrollHeight - window.innerHeight;
  window._scrollDocHGlobal = _scrollDocH;

  // ── Single passive scroll listener (replaces 5 separate ones) ──
  window.addEventListener('scroll', function(){
    currentSY = window.pageYOffset;
    if(!scrollTicking){
      requestAnimationFrame(runAllScrollWork);
      scrollTicking = true;
    }
  }, {passive: true});

  // Initial paint
  currentSY = window.pageYOffset;
  dimsumLastSY = currentSY;
  requestAnimationFrame(runAllScrollWork);
})();

// ============ SCROLL-REVEAL (IntersectionObserver) — SHARED IO ============
// PERF v35: satu IO untuk semua .sr (bukan per-element) → kurangi observer overhead
(function(){
  var els=document.querySelectorAll('.sr');
  if(!els.length)return;
  // Low-end: show semua langsung, skip observer overhead
  if(window._KD_LOW){
    els.forEach(function(e){ e.classList.add('sr-visible'); });
    return;
  }
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('sr-visible');
        io.unobserve(e.target); // animate once — stop observing to save resources
      }
    });
  },{threshold:0.12,rootMargin:'0px 0px -30px 0px'});
  els.forEach(function(el){io.observe(el);});
})();

// ============ MENU CARD STAGGER ENTRANCE ============
var _menuCardObserver = null;
function animateMenuCards(){
  var cards=document.querySelectorAll('.menu-card');
  // PERF v35: low-end — show langsung tanpa observer overhead
  if(window._KD_LOW){
    cards.forEach(function(c){ c.classList.add('card-visible'); });
    return;
  }
  cards.forEach(function(c){c.classList.remove('card-visible');});
  if(_menuCardObserver){ _menuCardObserver.disconnect(); _menuCardObserver=null; }
  // PERF v35: satu IO untuk semua card, stagger lebih cepat agar tidak terasa patah
  var staggerMs = window._KD_MID ? 20 : 30;
  _menuCardObserver=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        var idx=Array.from(document.querySelectorAll('.menu-card')).indexOf(e.target);
        setTimeout(function(){e.target.classList.add('card-visible');},idx*staggerMs);
        _menuCardObserver.unobserve(e.target); // animate once
      }
    });
  },{threshold:0.08});
  cards.forEach(function(c){_menuCardObserver.observe(c);});
}

// ============ COUNTER ANIMATION (hero-stats) ============
(function(){
  function animateCounter(el){
    var target=parseFloat(el.getAttribute('data-count'));
    var suffix=el.getAttribute('data-suffix')||'';
    // PERF v35: low-end → set nilai langsung, skip rAF loop
    if(window._KD_LOW){
      var isDecimal=target%1!==0;
      var suffixEl=el.querySelector('svg');
      var suffixHTML=suffixEl?suffixEl.outerHTML:'';
      el.innerHTML=(isDecimal?target.toFixed(1):target.toLocaleString('id-ID'))+(suffix&&!suffixEl?suffix:'')+suffixHTML;
      return;
    }
    var isDecimal=target%1!==0;
    var duration=1400;
    var start=null;
    // Simpan inner suffix HTML (misalnya SVG bintang)
    var suffixEl=el.querySelector('svg');
    var suffixHTML=suffixEl?suffixEl.outerHTML:'';
    function step(ts){
      if(!start)start=ts;
      var progress=Math.min((ts-start)/duration,1);
      // Ease-out cubic
      var ease=1-Math.pow(1-progress,3);
      var cur=target*ease;
      var display=isDecimal?cur.toFixed(1):Math.floor(cur).toLocaleString('id-ID');
      el.innerHTML=display+(suffix&&!suffixEl?suffix:'')+suffixHTML;
      if(progress<1) requestAnimationFrame(step);
      else{ el.innerHTML=(isDecimal?target.toFixed(1):target.toLocaleString('id-ID'))+(suffix&&!suffixEl?suffix:'')+suffixHTML; }
    }
    requestAnimationFrame(step);
  }

  var statsEl=document.querySelector('.hero-stats');
  if(!statsEl) return;
  var nums=statsEl.querySelectorAll('.stat-num[data-count]');
  if(!nums.length) return;

  var triggered=false;
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting&&!triggered){
        triggered=true;
        nums.forEach(function(n,i){ setTimeout(function(){animateCounter(n);},i*120); });
        io.disconnect();
      }
    });
  },{threshold:0.5});
  io.observe(statsEl);
})();


// ============ HERO CONTENT STAGGER ============
(function(){
  var items=[
    document.querySelector('.hero-eyebrow'),
    document.querySelector('.hero-title'),
    document.querySelector('.hero-sub'),
    document.querySelector('.hero-btns'),
    document.querySelector('.hero-stats')
  ];
  items.forEach(function(el,i){
    if(!el)return;
    el.style.opacity='0';
    el.style.transform='translateY(28px)';
    el.style.transition='opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1)';
    el.style.transitionDelay=(i*0.13+0.15)+'s';
    setTimeout(function(){
      el.style.opacity='1';
      el.style.transform='none';
    },60);
  });
})();

// ============ LEAFLET MAP ============
var mapInstance=null;
// Sync dari cabangData — semua lokasi real berdasarkan Google Maps
var cabangGeo=cabangData.map(function(c){return{
  lat:c.lat,lng:c.lng,name:c.name,addr:c.addr,
  jam:c.jam,rating:c.rating,wa:c.wa,open:c.open,
  mapsUrl:c.mapsUrl,type:c.type
};});

function initMap(){
  if(mapInstance)return;
  var mapEl=document.getElementById('cabang-map');
  if(!mapEl||typeof L==='undefined')return;
  mapInstance=L.map('cabang-map',{
    zoomControl:true,
    scrollWheelZoom:false,
    preferCanvas:true   // render marker ke Canvas, jauh lebih ringan dari SVG/DOM
  }).setView([-6.43,106.74],13);

  // CartoDB Positron — CDN global, tile ringan, label minimal, HTTPS
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains:'abcd',
    maxZoom:19,
    keepBuffer:1,              // kurangi tile yang disimpan buffer (hemat memori)
    updateWhenZooming:false,   // jangan reload tile saat zoom animasi (anti-patah)
    updateWhenIdle:true,       // update tile hanya saat panning berhenti
    detectRetina:false         // nonaktifkan retina (2x tile = 4x beban network)
  }).addTo(mapInstance);

  // Preload logo SEKALI — semua marker pakai cache yang sama, bukan 15x HTTP request
  var _logoDataUrl = null;
  var _logoSize = 20;
  function _cacheLogo(callback){
    if(_logoDataUrl){ callback(_logoDataUrl); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      var oc = document.createElement('canvas');
      oc.width = oc.height = _logoSize * 2; // 2x untuk ketajaman
      var ox = oc.getContext('2d');
      ox.beginPath(); ox.arc(_logoSize,_logoSize,_logoSize,0,Math.PI*2); ox.clip();
      ox.drawImage(img, 0, 0, _logoSize*2, _logoSize*2);
      _logoDataUrl = oc.toDataURL('image/png');
      callback(_logoDataUrl);
    };
    img.onerror = function(){ callback(null); };
    img.src = 'gambar/logo.png';
  }

  function makeIcon(type, logoUrl){
    var bg = type==='produksi' ? '#B8923A' : type==='agen' ? '#3A9E6E' : '#B83232';
    var inner = '';
    if(type==='produksi'){
      inner = '<div style="position:absolute;top:4px;left:4px;width:20px;height:20px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="#B83232" stroke-width="2" width="12" height="12" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M3 20V8l9-6 9 6v12"/><path d="M9 20V14h6v6"/></svg></div>';
    } else if(logoUrl){
      // Pakai dataURL dari cache — ZERO network request per marker
      // BUG FIX: dulu ada transform:rotate(45deg) di sini — niatnya menetralkan
      // rotate(-45deg) milik div pin (baris di bawah) supaya logo tetap tegak.
      // Tapi div ini SIBLING dari div pin (bukan child di dalamnya), jadi rotasi
      // CSS pin tidak diwariskan ke sini — rotate(45deg) ini cuma bikin logo
      // ikut miring 45° sendiri (persis "miring jam 1" yang dilaporkan).
      inner = '<div style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;overflow:hidden">'
        +'<img src="'+logoUrl+'" style="width:20px;height:20px;object-fit:cover;display:block" loading="eager">'
        +'</div>';
    } else {
      inner = '<div style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="#B83232" stroke-width="2" width="12" height="12" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.4 7 12.5 7.3 12.8a1 1 0 001.4 0C13 22.5 20 15.4 20 10a8 8 0 00-8-8z"/></svg></div>';
    }
    return L.divIcon({
      className:'',
      html:'<div style="position:relative;width:32px;height:40px">'
        +'<div style="width:28px;height:28px;background:'+bg+';border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);position:absolute;top:0;left:0"></div>'
        +inner
        +'</div>',
      iconSize:[32,40],iconAnchor:[14,40],popupAnchor:[2,-42]
    });
  }

  // Load logo sekali, baru render semua marker
  _cacheLogo(function(logoUrl){
    _renderMarkers(logoUrl);
  });

  function _renderMarkers(logoUrl){

  // MarkerClusterGroup — gabungkan marker dekat saat zoom out, hemat render DOM
  var clusterGroup = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        chunkedLoading: true   // render marker batch per frame, tidak block UI
      })
    : null;

  // Filter hanya cabang yang punya koordinat valid (bukan 0,0)
  var validGeo = cabangGeo.filter(function(c){ return c.lat !== 0 && c.lng !== 0; });
  if(!validGeo.length){
    // Fallback: tampilkan pesan jika belum ada koordinat
    var mapEl2=document.getElementById('cabang-map');
    if(mapEl2) mapEl2.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:.85rem;text-align:center;padding:20px;gap:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.4 7 12.5 7.3 12.8a1 1 0 001.4 0C13 22.5 20 15.4 20 10a8 8 0 00-8-8z"/></svg>Koordinat cabang belum dikonfigurasi.<br>Tambahkan lat/lng di data cabang.</div>';
    return;
  }
  validGeo.forEach(function(c){
    var icon=makeIcon(c.type, logoUrl);
    var marker=L.marker([c.lat,c.lng],{icon:icon});
    var statusHtml=c.open
      ?'<span style="display:inline-block;font-size:.63rem;padding:2px 8px;border-radius:100px;font-weight:700;background:#ECFDF5;color:#059669;margin-bottom:8px">● Buka Sekarang</span>'
      :'<span style="display:inline-block;font-size:.63rem;padding:2px 8px;border-radius:100px;font-weight:700;background:#FEF2F2;color:#DC2626;margin-bottom:8px">● Tutup</span>';
    var typeLabel=c.type==='produksi'?'Rumah Produksi':c.type==='agen'?'Agen Distribusi':'Cabang';
    // BUG FIX SEC-06: escape HTML di field teks sebelum dimasukkan ke popup innerHTML
    // Mencegah HTML injection jika data cabang suatu saat berasal dari API/database
    function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    // BUG FIX: popup peta ini sebelumnya pakai c.mapsUrl mentah tanpa validasi scheme
    // (beda dengan halaman publik yang sudah ada CRIT-3 fix) — bisa jadi link mati
    // (tanpa protokol) atau celah javascript: URL kalau data datang dari API.
    var _rawMapsPin = (c.mapsUrl||'').trim();
    var safeMapsUrlPin = '#';
    if(_rawMapsPin){
      var _withProtoPin = /^https?:\/\//i.test(_rawMapsPin) ? _rawMapsPin
        : (!/^[a-z][a-z0-9+.-]*:/i.test(_rawMapsPin) ? 'https://'+_rawMapsPin : '');
      if(/^https:\/\//.test(_withProtoPin)) safeMapsUrlPin = _withProtoPin;
    }
    marker.bindPopup(
      '<div style="padding:14px 16px;min-width:200px;font-family:sans-serif">'
      +'<div style="font-size:.65rem;color:#888;margin-bottom:3px">'+typeLabel+'</div>'
      +'<div style="font-weight:700;font-size:.9rem;color:#1A1A1A;margin-bottom:4px">'+_esc(c.name)+'</div>'
      +'<div style="font-size:.74rem;color:#888;margin-bottom:2px;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" width="11" height="11" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.4 7 12.5 7.3 12.8a1 1 0 001.4 0C13 22.5 20 15.4 20 10a8 8 0 00-8-8z"/></svg>'+_esc(c.addr)+'</div>'
      +'<div style="font-size:.74rem;color:#888;margin-bottom:8px;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" width="11" height="11" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'+_esc(c.jam)+'</div>'
      +statusHtml
      +'<div style="display:flex;gap:6px;margin-top:6px">'
      +'<a href="'+safeMapsUrlPin+'" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;background:#B83232;color:#fff;text-align:center;padding:7px 8px;border-radius:7px;font-size:.74rem;font-weight:600;text-decoration:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.4 7 12.5 7.3 12.8a1 1 0 001.4 0C13 22.5 20 15.4 20 10a8 8 0 00-8-8z"/></svg>Google Maps</a>'
      +'<a href="https://wa.me/'+_esc(c.wa)+'?text=Halo%20'+encodeURIComponent(c.name)+'%2C%20saya%20ingin%20bertanya..." target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;background:#22C55E;color:#fff;text-align:center;padding:7px 8px;border-radius:7px;font-size:.74rem;font-weight:600;text-decoration:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>WhatsApp</a>'
      +'</div>'
      +'</div>',
      {maxWidth:250}
    );
    if(clusterGroup) clusterGroup.addLayer(marker);
    else marker.addTo(mapInstance);
  });
  if(clusterGroup) mapInstance.addLayer(clusterGroup);
  var bounds=L.latLngBounds(validGeo.map(function(c){return[c.lat,c.lng];}));
  if(bounds.isValid()) mapInstance.fitBounds(bounds,{padding:[40,40]});
  } // end _renderMarkers
}

function switchCabangTab(tab){
  var daftar=document.getElementById('cabang-daftar-view');
  var peta=document.getElementById('cabang-peta-view');
  var tbD=document.getElementById('tab-daftar');
  var tbP=document.getElementById('tab-peta');
  if(tab==='peta'){
    daftar.style.display='none';peta.style.display='block';
    tbD.classList.remove('active');tbP.classList.add('active');
    _loadLeaflet(function(){ setTimeout(function(){initMap();if(mapInstance)mapInstance.invalidateSize();},150); });
  }else{
    daftar.style.display='block';peta.style.display='none';
    tbD.classList.add('active');tbP.classList.remove('active');
  }
}
// FIX v59: tambah delay lebih panjang + fallback scrollTo agar peta selalu terbuka tuntas
function goToCabangPeta(){
  switchCabangTab('peta');
  // Tunggu map render + scroll ke section. Pakai dua tahap:
  // 1) rAF pertama: layout sudah terhitung
  // 2) 200ms: Leaflet sudah invalidateSize, tile mulai load
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      var el = document.getElementById('cabang');
      if(!el) return;
      try {
        el.scrollIntoView({behavior:'smooth', block:'start'});
      } catch(e) {
        // Fallback untuk browser yang tidak support options
        window.scrollTo({top: el.getBoundingClientRect().top + window.pageYOffset - 60, behavior:'smooth'});
      }
      // Kedua: pastikan map benar-benar resize setelah scroll settle
      setTimeout(function(){
        if(window.mapInstance) window.mapInstance.invalidateSize(true);
      }, 400);
    });
  });
}

// SCROLL PROGRESS BAR → merged into unified scroll engine (see PERF v11)
// BEFORE: bar.style.width = pct+'%'  ← triggers layout (width change)
// AFTER:  bar.style.transform = 'scaleX(n)' ← GPU composited, zero layout
(function(){
  var bar = document.getElementById('scroll-progress-bar');
  if(!bar) return;
  // Override width-based approach: use transform-origin + scaleX
  bar.style.width       = '100%';
  bar.style.transformOrigin = 'left center';
  bar.style.transform   = 'scaleX(0)';
})();

// DIMSUM FIXED SPINNER → merged into unified scroll engine (see PERF v11)
(function(){
  var el = document.getElementById('dimsum-fixed');
  if(!el) return;
  el.style.opacity = '1';
  el.style.transform = 'translateY(-50%) rotate(0deg)';
})();

// ============ FLOATING FOOD DECORATION OBSERVER ============
(function(){
  var decos = document.querySelectorAll('.float-deco');
  if(!decos.length) return;
  if(window._KD_LOW){ decos.forEach(function(d){ d.classList.add('fd-visible'); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('fd-visible');
        io.unobserve(e.target); // animate once
      }
    });
  }, {threshold:0.05});
  decos.forEach(function(d){ io.observe(d); });
})();

// ============ BIDIRECTIONAL SCROLL ANIMATIONS ============
// PERF v35: low-end → skip semua, show langsung. High/Mid → IO seperti biasa.
function makeBiIO(onEnter, onLeave, options){
  var _io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        onEnter(e.target);
        _io.unobserve(e.target); // animate once — no jank on scroll back
      }
    });
  }, options || {threshold:0.1});
  return _io;
}

// ---- VALUE CARDS ----
(function(){
  var cards = document.querySelectorAll('.value-card');
  if(!cards.length) return;
  if(window._KD_LOW){ cards.forEach(function(c){ c.classList.add('vc-visible'); }); return; }
  var io = makeBiIO(
    function(el){ var idx=Array.from(cards).indexOf(el); setTimeout(function(){el.classList.add('vc-visible');},idx*80); },
    function(el){ el.classList.remove('vc-visible'); },
    {threshold:0.1}
  );
  cards.forEach(function(c){ io.observe(c); });
})();

// ---- LOYALTY TIER CARDS ----
(function(){
  var cards = document.querySelectorAll('.loyalty-tier-card');
  if(!cards.length) return;
  if(window._KD_LOW){ cards.forEach(function(c){ c.classList.add('ltc-visible'); }); return; }
  var io = makeBiIO(
    function(el){ var idx=Array.from(cards).indexOf(el); setTimeout(function(){el.classList.add('ltc-visible');},idx*100); },
    function(el){ el.classList.remove('ltc-visible'); },
    {threshold:0.08}
  );
  cards.forEach(function(c){ io.observe(c); });
})();

// ---- FRANCHISE STATS ----
(function(){
  var cards = document.querySelectorAll('.fstat');
  if(!cards.length) return;
  if(window._KD_LOW){ cards.forEach(function(c){ c.classList.add('fs-visible'); }); return; }
  var io = makeBiIO(
    function(el){ var idx=Array.from(cards).indexOf(el); setTimeout(function(){el.classList.add('fs-visible');},idx*120); },
    function(el){ el.classList.remove('fs-visible'); },
    {threshold:0.1}
  );
  cards.forEach(function(c){ io.observe(c); });
})();

// ---- DYNAMICALLY RENDERED CARDS (promo, testi, cabang) ----
// v82 FIX: biObserveClass diangkat ke module-level dan di-expose via window._reAttachCardObservers
// agar goToPage('home') bisa memanggil ulang setelah renderPromo/renderTestimoni inject kartu baru.
// ROOT CAUSE bug sebelumnya: polling berhenti setelah ~6.4 detik (8x * 800ms), sehingga
// kartu yang di-render saat kembali ke home (setelah admin) tidak pernah dapat pc-visible/tc-visible
// dan selamanya opacity:0.
(function(){
  if(window._KD_LOW) return;

  function biObserveClass(selector, addCls, removeCls, delay, thresh){
    var nodes = document.querySelectorAll(selector+':not(.bio-attached)');
    nodes.forEach(function(el){
      el.classList.add('bio-attached');
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){
            var allNodes = Array.from(document.querySelectorAll(selector));
            var idx = allNodes.indexOf(e.target);
            setTimeout(function(){ e.target.classList.add(addCls); }, idx*(delay||80));
          } else {
            e.target.classList.remove(addCls);
          }
        });
      },{threshold: thresh||0.08});
      io.observe(el);
    });
  }

  // Expose ke global — dipanggil dari goToPage('home') setelah re-render
  window._reAttachCardObservers = function(){
    biObserveClass('.promo-card', 'pc-visible', null, 100, 0.08);
    biObserveClass('.testi-card', 'tc-visible', null, 80, 0.08);
    biObserveClass('.cabang-card', 'cc-visible', null, 70, 0.07);
  };

  // Polling awal saat pertama load
  var pollCount = 0;
  var pollTimer = setInterval(function(){
    window._reAttachCardObservers();
    if(++pollCount > 8) clearInterval(pollTimer);
  }, 800);
})();

// ---- SECTION HEADERS ----
(function(){
  var headers = document.querySelectorAll('.section-header');
  if(!headers.length) return;
  if(window._KD_LOW){
    headers.forEach(function(h){ h.style.opacity='1'; h.style.transform='none'; });
    return;
  }
  headers.forEach(function(h){
    h.style.opacity='0';
    h.style.transform='scale(0.93) translateY(28px)';
    h.style.transition='opacity .75s cubic-bezier(.16,1,.3,1), transform .75s cubic-bezier(.16,1,.3,1)';
  });
  var io = makeBiIO(
    function(el){ el.style.opacity='1'; el.style.transform='scale(1) translateY(0)'; },
    function(el){ el.style.opacity='0'; el.style.transform='scale(0.93) translateY(28px)'; },
    {threshold:0.15, rootMargin:'0px 0px -20px 0px'}
  );
  headers.forEach(function(h){ io.observe(h); });
})();

// ---- ABOUT VISUAL ----
(function(){
  var v = document.querySelector('.about-visual');
  if(!v) return;
  if(window._KD_LOW){ v.style.opacity='1'; v.style.transform='none'; return; }
  v.style.opacity='0';
  v.style.transform='scale(0.85) rotate(-4deg)';
  v.style.transition='opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.34,1.3,.64,1)';
  var io = makeBiIO(
    function(el){ el.style.opacity='1'; el.style.transform='scale(1) rotate(0deg)'; },
    function(el){ el.style.opacity='0'; el.style.transform='scale(0.85) rotate(-4deg)'; },
    {threshold:0.12}
  );
  io.observe(v);
})();

// ---- LOYALTY HERO ----
(function(){
  var lh = document.querySelector('.loyalty-hero');
  if(!lh) return;
  if(window._KD_LOW){ lh.style.opacity='1'; lh.style.transform='none'; return; }
  lh.style.opacity='0';
  lh.style.transform='scale(0.9) translateY(40px)';
  lh.style.transition='opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.34,1.2,.64,1)';
  var io = makeBiIO(
    function(el){ el.style.opacity='1'; el.style.transform='scale(1) translateY(0)'; },
    function(el){ el.style.opacity='0'; el.style.transform='scale(0.9) translateY(40px)'; },
    {threshold:0.1}
  );
  io.observe(lh);
})();

// ---- FRANCHISE BOX ----
(function(){
  var fb = document.querySelector('.franchise-box');
  if(!fb) return;
  if(window._KD_LOW){ fb.style.opacity='1'; fb.style.transform='none'; return; }
  fb.style.opacity='0';
  fb.style.transform='scale(0.92) translateY(32px)';
  fb.style.transition='opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.34,1.2,.64,1)';
  var io = makeBiIO(
    function(el){ el.style.opacity='1'; el.style.transform='scale(1) translateY(0)'; },
    function(el){ el.style.opacity='0'; el.style.transform='scale(0.92) translateY(32px)'; },
    {threshold:0.08}
  );
  io.observe(fb);
})();

// ---- FAQ ITEMS ----
(function(){
  function observeFaqItems(){
    var items = document.querySelectorAll('.faq-item:not(.fq-attached)');
    if(!items.length) return;
    if(window._KD_LOW){
      items.forEach(function(item){ item.style.opacity='1'; item.style.transform='none'; });
      return;
    }
    items.forEach(function(item,i){
      item.classList.add('fq-attached');
      item.style.opacity='0';
      item.style.transform='translateX(-30px)';
      item.style.transition='opacity .5s ease '+(i*.06)+'s, transform .5s cubic-bezier(.16,1,.3,1) '+(i*.06)+'s';
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){ e.target.style.opacity='1'; e.target.style.transform='translateX(0)'; }
          else { e.target.style.opacity='0'; e.target.style.transform='translateX(-30px)'; }
        });
      },{threshold:0.08});
      io.observe(item);
    });
  }
  setTimeout(observeFaqItems, window._KD_LOW ? 0 : 800);
})();

// ---- KONTAK ITEMS ----
(function(){
  var items = document.querySelectorAll('.kontak-item');
  if(!items.length) return;
  if(window._KD_LOW){ items.forEach(function(item){ item.style.opacity='1'; item.style.transform='none'; }); return; }
  items.forEach(function(item,i){
    item.style.opacity='0';
    item.style.transform='translateX(-24px)';
    item.style.transition='opacity .5s ease '+(i*.09)+'s, transform .5s cubic-bezier(.16,1,.3,1) '+(i*.09)+'s';
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.style.opacity='1'; e.target.style.transform='translateX(0)'; }
        else { e.target.style.opacity='0'; e.target.style.transform='translateX(-24px)'; }
      });
    },{threshold:0.12});
    io.observe(item);
  });
})();

// ---- FOOTER ----
(function(){
  var footer = document.querySelector('footer');
  if(!footer) return;
  if(window._KD_LOW){ footer.style.opacity='1'; footer.style.transform='none'; return; }
  footer.style.opacity='0';
  footer.style.transform='translateY(30px)';
  footer.style.transition='opacity .8s ease, transform .8s cubic-bezier(.16,1,.3,1)';
  var io = makeBiIO(
    function(el){ el.style.opacity='1'; el.style.transform='translateY(0)'; },
    function(el){ el.style.opacity='0'; el.style.transform='translateY(30px)'; },
    {threshold:0.06}
  );
  io.observe(footer);
})();

// PARALLAX BG TEXT → merged into unified scroll engine (see PERF v11)
// sectionTopCache pre-computes offsetTop chain once per element, not per frame

// ✅ UX FIX — footer tahun dinamis (tidak perlu update manual tiap tahun)
(function(){ const el=document.getElementById('footer-year'); if(el) el.textContent=new Date().getFullYear(); })();

renderCabang();
renderPromo();
renderTestimoni();
renderFAQ();

// BUG FIX: cabang baru yang ditambah admin tersimpan benar ke Supabase,
// tapi pengunjung publik (belum login) tidak pernah fetch ulang — _sbLoadAll()
// cuma jalan SETELAH admin login (lihat komentar data.js: "diisi dari Supabase
// setelah login"). Akibatnya cabangData publik selalu pakai array statis
// hardcode di data.js, pin cabang baru tidak pernah muncul untuk customer.
// Fix: tampilkan dulu data statis (instan, tanpa nunggu network — UX tetap cepat),
// lalu diam-diam upgrade ke data live begitu Supabase selesai di-fetch.
(function _publicRefreshCabang(){
  if(typeof _loadSupabase !== 'function') return;
  setTimeout(function(){
    _loadSupabase(function(){
      var sb = (typeof getSB === 'function') ? getSB() : null;
      if(!sb) return;
      sb.from('cabang').select('*').order('id',{ascending:true}).then(function(res){
        var cabRows = res.data, cabErr = res.error;
        if(cabErr || !cabRows || !cabRows.length) return;
        cabangData.length = 0;
        cabRows.forEach(function(r){
          cabangData.push({id:r.id,name:r.name,addr:r.addr||'',jam:r.jam||'08.00–21.00',
            rating:r.rating||5,wa:r.wa||'',open:r.open!==false,lat:r.lat||0,lng:r.lng||0,
            mapsUrl:r.maps_url||'',type:r.type||'cabang'});
        });
        cabangGeo = cabangData.map(function(c){return{lat:c.lat,lng:c.lng,name:c.name,addr:c.addr,
          jam:c.jam,rating:c.rating,wa:c.wa,open:c.open,mapsUrl:c.mapsUrl,type:c.type};});
        renderCabang();
        // Map mungkin sudah sempat dibuka pengunjung sebelum fetch ini selesai —
        // hapus instance lama supaya initMap() berikutnya pakai cabangGeo yang baru.
        if(mapInstance){ mapInstance.remove(); mapInstance=null; initMap(); }
        console.log('[KD] cabang publik di-refresh dari Supabase:', cabangData.length, 'cabang');
      }).catch(function(e){ console.warn('[KD] public cabang refresh gagal:', e.message); });
    });
  }, 800); // beri jeda agar tidak rebutan bandwidth dengan render awal/gambar hero
})();






// ===== TALI MELILIT NAVBAR — posisi dinamis (fixed elements) =====
(function(){
  // PERF v35: skip tali dekorasi di low-end — tidak ada nilai fungsi, hanya visual
  if(window._KD_LOW) return;
  var ropeBehind  = document.getElementById('rope-behind');
  var ropeLine    = document.getElementById('rope-behind-line');
  var ropeWrap    = document.querySelector('.rope-wrap');
  var hanger      = document.getElementById('nav-logo-hanger');
  if(!ropeBehind||!ropeLine||!ropeWrap||!hanger) return;

  var ROPE_DROP = 62; // px tali menggantung dari bawah nav

  function layout(){
    var nav = document.getElementById('main-nav');
    if(!nav) return;
    var r = nav.getBoundingClientRect();

    // Posisi X: dekat kanan nav, sejajar semua elemen
    var xPos = r.right - 76; // 76px dari kanan nav

    // ---- Tali di belakang nav (z-index:999, di bawah nav) ----
    ropeBehind.style.left = xPos + 'px';
    // Tinggi = dari atas viewport sampai bawah nav + rope drop
    ropeLine.style.height = (r.bottom + ROPE_DROP + 26) + 'px'; // +26 = setengah logo

    // ---- Rope-wrap melilit di atas nav (z-index:1003) ----
    ropeWrap.style.left = xPos + 'px';
    ropeWrap.style.top  = r.top + 'px';
    ropeWrap.style.height = (r.height + 4) + 'px';

    // ---- Hanger logo (animasi swing) ----
    // top = bawah nav + rope drop (agar logo menggantung di ujung tali)
    hanger.style.left = (xPos - 14) + 'px'; // -14 agar logo center di atas tali
    hanger.style.top  = (r.bottom + ROPE_DROP) + 'px';
  }

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      layout();
      window.addEventListener('resize', layout);
      window.addEventListener('scroll', layout, {passive:true});
    });
  });
})();


(function(){
  var canvas = document.getElementById('hanging-sign-canvas');
  var hitbox = document.getElementById('hanging-sign-hitbox');
  var nav    = document.getElementById('main-nav');
  if(!canvas||!hitbox) return;
  var ctx = canvas.getContext('2d');

  var R     = 32;
  var SEG   = 18;        // more segments = smoother rope at distance
  var GRAV  = 0.45;
  var DAMP  = 0.976;     // slightly more damping = less jitter
  var ITER  = 30;        // more iterations = rock-solid constraints
  var SLACK = 1.05;      // natural rope segment rest-length multiplier

  var anchor = {x:0, y:0};
  var rope   = [];
  var sign   = {x:0, y:0, px:0, py:0};
  var isDrag = false, dox=0, doy=0;

  var logo = new Image();
  var logoCache = null; // OffscreenCanvas cache — render 1x, pakai terus
  var logoCacheSize = 0;

  function buildLogoCache(ir){
    // (Re)build hanya jika ukuran berubah
    if(logoCache && logoCacheSize === ir) return;
    var size = ir * 2;
    // Gunakan OffscreenCanvas jika tersedia, fallback ke <canvas>
    var oc;
    try{ oc = new OffscreenCanvas(size, size); }
    catch(e){ oc = document.createElement('canvas'); oc.width=size; oc.height=size; }
    var octx = oc.getContext('2d');
    octx.clearRect(0,0,size,size);
    // FIX v46 LOGO: reset ke identitas — logo selalu tegak lurus, tidak ikut rotasi canvas parent
    octx.setTransform(1,0,0,1,0,0);
    // Clip lingkaran
    octx.beginPath(); octx.arc(ir,ir,ir,0,Math.PI*2); octx.clip();
    // Gambar logo penuh ke dalam circle — 1x saja
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(logo, 0, 0, size, size);
    logoCache = oc;
    logoCacheSize = ir;
  }

  logo.onload = function(){
    buildLogoCache(R-5);
  };
  logo.src = 'gambar/logo.png';

  function getAnchorEl(){
    var adminPage = document.getElementById('page-admin-dash');
    if(adminPage && adminPage.classList.contains('active')){
      return document.querySelector('.btn-keluar-topbar');
    }
    return nav;
  }

  function getAnchor(){
    var el = getAnchorEl();
    if(!el){ anchor.x = window.innerWidth - 28; anchor.y = 60; return; }
    var r = el.getBoundingClientRect();
    var adminPage = document.getElementById('page-admin-dash');
    var onAdmin = adminPage && adminPage.classList.contains('active');
    // Di admin: gantung dari tengah tombol Keluar
    // Di home: gantung dari pojok kanan nav (posisi asli)
    anchor.x = onAdmin ? (r.left + r.width / 2) : (r.right - 28);
    anchor.y = r.bottom;
  }

  function restY(){ return anchor.y + 88; }

  function init(){
    getAnchor();
    sign.x=anchor.x; sign.y=restY();
    sign.px=sign.x; sign.py=sign.y;
    makeRope();
    updateHitbox();
  }
  window.hangingSignReinit = function(){ _anchorDirty=true; getAnchor(); _anchorDirty=false; sign.x=anchor.x; sign.y=restY(); sign.px=sign.x; sign.py=sign.y; makeRope(); _skipCount=0; _signMoving=true; startLoop(); };

  function makeRope(){
    rope = [];
    var ax=anchor.x, ay=anchor.y;
    var bx=sign.x,   by=sign.y - R;
    for(var i=0; i<=SEG; i++){
      var t=i/SEG;
      var x=ax+(bx-ax)*t, y=ay+(by-ay)*t;
      rope.push({x:x,y:y,px:x,py:y,pinned:i===0});
    }
  }

  function naturalSegLen(){
    // distance anchor→attach * slack / SEG — recalculated each frame
    // so rope never fights itself when stretched far
    var bx=sign.x, by=sign.y-R;
    var dx=bx-anchor.x, dy=by-anchor.y;
    var dist=Math.sqrt(dx*dx+dy*dy);
    return (dist * SLACK) / SEG;
  }

  function stepRope(){
    var bx=sign.x, by=sign.y-R;
    var sl=naturalSegLen();

    // Verlet
    for(var i=0;i<rope.length;i++){
      var n=rope[i];
      if(n.pinned){n.x=anchor.x;n.y=anchor.y;n.px=anchor.x;n.py=anchor.y;continue;}
      var vx=(n.x-n.px)*DAMP, vy=(n.y-n.py)*DAMP+GRAV;
      n.px=n.x; n.py=n.y; n.x+=vx; n.y+=vy;
    }

    // Hard-pin end to sign top
    var last=rope[rope.length-1];
    last.x=bx; last.y=by; last.px=bx; last.py=by;

    // Constraint passes
    for(var it=0;it<ITER;it++){
      rope[0].x=anchor.x; rope[0].y=anchor.y;
      for(var i=0;i<rope.length-1;i++){
        var a=rope[i], b=rope[i+1];
        var dx=b.x-a.x, dy=b.y-a.y;
        var d=Math.sqrt(dx*dx+dy*dy)||0.001;
        var diff=(d-sl)/d*0.5;
        if(!a.pinned){a.x+=dx*diff; a.y+=dy*diff;}
        if(i<rope.length-2){b.x-=dx*diff; b.y-=dy*diff;}
      }
      rope[0].x=anchor.x; rope[0].y=anchor.y;
      last.x=bx; last.y=by;
    }
  }

  var _signMoving = false; // true saat sign masih bergerak
  function stepSign(){
    if(isDrag) return;
    var vx=(sign.x-sign.px)*DAMP, vy=(sign.y-sign.py)*DAMP;
    // Gravity micro: hanya aktif jika papan jauh dari rest (bukan saat idle)
    var ry=restY(), rx=anchor.x;
    var distFromRest = Math.abs(sign.y-ry)+Math.abs(sign.x-rx);
    if(distFromRest > 2) vy += GRAV*0.04;
    sign.px=sign.x; sign.py=sign.y;
    sign.x+=vx; sign.y+=vy;
    // Spring back ke posisi istirahat
    var dy2=sign.y-ry, dx2=sign.x-rx;
    sign.x-=dx2*0.018;
    sign.y-=dy2*0.012;
    // Snap ke rest jika hampir diam — cegah micro-jitter selamanya
    var speed = Math.abs(vx)+Math.abs(vy);
    if(speed < 0.08 && distFromRest < 0.5){
      sign.x=rx; sign.y=ry; sign.px=rx; sign.py=ry;
      _signMoving = false;
      return;
    }
    // Soft ceiling
    if(sign.y<anchor.y+R+8){sign.y=anchor.y+R+8; sign.py=sign.y+(sign.y-sign.py)*0.5;}
    _signMoving = speed > 0.12;
  }

  function drawRope(){
    if(rope.length<2) return;
    ctx.beginPath();
    ctx.moveTo(rope[0].x, rope[0].y);
    for(var i=1;i<rope.length-1;i++){
      var mx=(rope[i].x+rope[i+1].x)*0.5, my=(rope[i].y+rope[i+1].y)*0.5;
      ctx.quadraticCurveTo(rope[i].x,rope[i].y,mx,my);
    }
    var l=rope[rope.length-1];
    ctx.lineTo(l.x,l.y);
    ctx.stroke();
  }

  // Cache disc decoration (ellipse pattern) — rebuild hanya saat tema berubah
  var _discCache = null;
  var _discCacheTheme = null;
  function buildDiscCache(dark){
    // Extra padding untuk shadow papan yang di-bake ke sini
    var PAD = 20; // ruang shadow atas/bawah/samping
    var size = R*2 + PAD*2;
    var oc;
    try{ oc = new OffscreenCanvas(size,size); }
    catch(e){ oc = document.createElement('canvas'); oc.width=size; oc.height=size; }
    var octx = oc.getContext('2d');
    var cx = R + PAD, cy = R + PAD;

    // Layer 0: drop shadow papan — di-bake di sini, zero di main ctx
    octx.shadowColor = dark?'rgba(0,0,0,0.55)':'rgba(30,10,2,0.28)';
    octx.shadowBlur  = 12;
    octx.shadowOffsetY = 4;
    var wgS = octx.createRadialGradient(cx,cy,0,cx,cy,R);
    if(dark){wgS.addColorStop(0,'#4A2008');wgS.addColorStop(1,'#2A1004');}
    else{wgS.addColorStop(0,'#B06828');wgS.addColorStop(1,'#7A4010');}
    octx.fillStyle = wgS;
    octx.beginPath(); octx.arc(cx,cy,R,0,Math.PI*2); octx.fill();
    octx.shadowBlur=0; octx.shadowColor='transparent'; octx.shadowOffsetY=0;

    // Layer 1: body fill (gradient, tanpa shadow)
    var wg = octx.createRadialGradient(cx-R*0.3,cy-R*0.3,R*0.1,cx,cy,R);
    if(dark){wg.addColorStop(0,'#7A3E18');wg.addColorStop(0.6,'#4A2008');wg.addColorStop(1,'#2A1004');}
    else{wg.addColorStop(0,'#E09850');wg.addColorStop(0.6,'#B06828');wg.addColorStop(1,'#7A4010');}
    octx.fillStyle = wg;
    octx.beginPath(); octx.arc(cx,cy,R,0,Math.PI*2); octx.fill();

    // Layer 2: ellipse decoration
    octx.globalAlpha=0.07;
    octx.strokeStyle=dark?'#fff':'#3a1800'; octx.lineWidth=0.8;
    for(var i=1;i<=3;i++){
      octx.beginPath();
      octx.ellipse(cx+i*1.5,cy+i*0.5,R*0.25*i,R*0.22*i,0.3,0,Math.PI*2);
      octx.stroke();
    }
    octx.globalAlpha=1;

    // Layer 3: gold border
    var rg = octx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
    rg.addColorStop(0,'#E8C050'); rg.addColorStop(0.5,'#B8923A'); rg.addColorStop(1,'#8B6C1A');
    octx.strokeStyle=rg; octx.lineWidth=2.8;
    octx.shadowColor='rgba(200,150,30,0.45)'; octx.shadowBlur=4;
    octx.beginPath(); octx.arc(cx,cy,R,0,Math.PI*2); octx.stroke();
    octx.shadowBlur=0; octx.shadowColor='transparent';

    // Simpan juga offset posisi (karena ada PAD)
    oc._cx = cx; oc._cy = cy; oc._pad = PAD;
    _discCache=oc; _discCacheTheme=dark?'dark':'light';
  }

  function drawSign(x,y){
    // Gunakan _darkCached (bukan getAttribute tiap frame)
    var dark = _darkCached;

    // FIX getar logo: snap ke integer pixel — koordinat float dari fisika Verlet
    // menyebabkan logo bergeser ±1px tiap frame (sub-pixel shimmer).
    // Round di sini: disc & clip ikut snapped sehingga semua layer terkunci rapi.
    var xi = Math.round(x);
    var yi = Math.round(y);

    // ── LAYER 1: disc dari cache (body+decoration+border — semua di offscreen) ──
    // Zero shadow di main ctx — tidak ada yang bisa flicker
    if(!_discCache || _discCacheTheme !== (dark?'dark':'light')) buildDiscCache(dark);
    // Offset = x/y - cx/cy dari cache (cx = R+PAD, cy = R+PAD)
    var _pad = _discCache._pad || 20;
    ctx.drawImage(_discCache, xi - R - _pad, yi - R - _pad);

    // ── LAYER 2: logo foto (dalam clip lingkaran) ──
    var ir = R-5;
    ctx.save();
    // FIX v46 LOGO: setTransform ke identitas setelah save() agar logo selalu lurus
    // Papan bisa berayun via Verlet tapi logo harus tetap tegak (tidak miring jam 1)
    ctx.setTransform(1,0,0,1,0,0);
    ctx.beginPath(); ctx.arc(xi,yi,ir,0,Math.PI*2); ctx.clip();
    if(logo.complete && logo.naturalWidth>0){
      if(!logoCache || logoCacheSize !== ir) buildLogoCache(ir);
      if(logoCache){
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(logoCache, xi-ir, yi-ir, ir*2, ir*2);
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logo, xi-ir, yi-ir, ir*2, ir*2);
      }
    } else {
      ctx.fillStyle = '#B83232';
      ctx.fillRect(xi-ir, yi-ir, ir*2, ir*2);
    }
    ctx.restore();

    // ── LAYER 3: hook kecil di atas ──
    ctx.strokeStyle = dark?'#C8A040':'#8B6C1A';
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(xi, yi-R+1, 4, Math.PI, 0); ctx.stroke();
  }

  function updateHitbox(){
    hitbox.style.left  =(sign.x-R-8)+'px';
    hitbox.style.top   =(sign.y-R-8)+'px';
    hitbox.style.width =(R*2+16)+'px';
    hitbox.style.height=(R*2+16)+'px';
    hitbox.style.borderRadius='50%';
  }

  // Cache dimensi — JANGAN assign canvas.width tiap frame (reset ctx = kedip)
  var _canvasW = 0, _canvasH = 0;
  function resizeCanvas(){
    // Pakai getBoundingClientRect agar CSS display size == pixel size (fix oval bug di HP)
    var rect = canvas.getBoundingClientRect();
    var W = Math.round(rect.width);
    var H = Math.round(rect.height);
    // Fallback jika rect belum tersedia
    if(!W || !H){
      var vv = window.visualViewport;
      W = vv ? Math.round(vv.width)  : window.innerWidth;
      H = vv ? Math.round(vv.height) : window.innerHeight;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
    } else {
      canvas.style.width  = '';
      canvas.style.height = '';
    }
    if(_canvasW === W && _canvasH === H) return;
    _canvasW = W; _canvasH = H;
    canvas.width = W; canvas.height = H;
    _discCache = null; logoCache = null;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, {passive:true});
  // visualViewport lebih akurat di HP — handle address bar naik/turun
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', resizeCanvas, {passive:true});
  }

  // Cache dark state — getAttribute mahal kalau tiap frame
  var _darkCached = document.documentElement.getAttribute('data-theme')==='dark';
  var _themeObserver = new MutationObserver(function(){
    var nowDark = document.documentElement.getAttribute('data-theme')==='dark';
    if(nowDark !== _darkCached){
      _darkCached = nowDark;
      _discCache = null; // rebuild disc dengan warna tema baru
    }
  });
  _themeObserver.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

  // ── ANCHOR CACHE — getAnchor() mahal (getBoundingClientRect), jangan tiap frame ──
  // Hanya di-refresh saat: init, resize, scroll berhenti, goToPage
  var _anchorDirty = true;
  function markAnchorDirty(){ _anchorDirty = true; }
  window.addEventListener('resize', markAnchorDirty, {passive:true});
  // Scroll: tandai dirty tapi dengan debounce — jangan tiap pixel scroll
  var _scrollDirtyTimer = null;
  window.addEventListener('scroll', function(){
    clearTimeout(_scrollDirtyTimer);
    _scrollDirtyTimer = setTimeout(function(){
      markAnchorDirty();
      // FIX: Bangunkan render loop — kalau loop sudah STOP (_skipCount > _STOP_AFTER),
      // anchor baru tidak akan pernah dipakai dan tali tetap hilang/stuck.
      _skipCount = 0;
      _signMoving = true;
    }, 80);
  }, {passive:true});

  // Adaptive fps — 60fps saat drag/swing, 30fps saat bergerak, STOP saat diam
  var _loopLastTs = 0;
  var _IDLE_MS = 33;   // ~30fps saat bergerak pelan
  var _skipCount = 0;  // frame berturut-turut saat papan diam → stop render
  var _STOP_AFTER = 6; // setelah 6 frame diam, berhenti total (sampai ada interaksi)
  var _loopRunning = false;

  function startLoop(){
    if(_loopRunning) return;
    _loopRunning = true;
    requestAnimationFrame(loop);
  }

  function loop(ts){
    // Refresh anchor hanya saat dirty
    if(_anchorDirty){
      var oldAnchorX = anchor.x, oldAnchorY = anchor.y;
      getAnchor();
      _anchorDirty = false;
      var dax = anchor.x - oldAnchorX;
      var day = anchor.y - oldAnchorY;
      if(Math.abs(dax) > 0.5 || Math.abs(day) > 0.5){
        sign.x  += dax; sign.px += dax;
        sign.y  += day; sign.py += day;
        for(var _ri=0; _ri<rope.length; _ri++){
          rope[_ri].x  += dax; rope[_ri].px += dax;
          rope[_ri].y  += day; rope[_ri].py += day;
        }
      }
    }

    var active = isDrag || _signMoving;

    // Throttle di idle
    if(!active && ts - _loopLastTs < _IDLE_MS){
      requestAnimationFrame(loop);
      return;
    }
    _loopLastTs = ts;

    // Benar-benar diam → stop render hemat baterai
    if(!active){
      _skipCount++;
      if(_skipCount === _STOP_AFTER){
        updateHitbox(); // update posisi hitbox SEBELUM berhenti
      }
      if(_skipCount > _STOP_AFTER){
        _loopRunning = false; // izinkan restart
        return; // berhenti — startLoop() akan dipanggil saat touch
      }
    } else {
      _skipCount = 0;
    }

    ctx.clearRect(0, 0, _canvasW, _canvasH);

    stepSign();
    stepRope();

    ctx.save();
    ctx.strokeStyle = _darkCached ? '#A07840' : '#6B3C10';
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawRope();
    ctx.restore();

    drawSign(sign.x, sign.y);
    updateHitbox();
    requestAnimationFrame(loop);
  }

  function evXY(e){return e.touches?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY};}

  hitbox.addEventListener('mousedown',function(e){
    e.preventDefault();isDrag=true;hitbox.style.cursor='grabbing';
    _skipCount=0; startLoop();
    var p=evXY(e);dox=sign.x-p.x;doy=sign.y-p.y;
  });
  hitbox.addEventListener('touchstart',function(e){
    e.preventDefault();isDrag=true;
    _skipCount=0; startLoop();
    var p=evXY(e);dox=sign.x-p.x;doy=sign.y-p.y;
  },{passive:false});
  window.addEventListener('mousemove',function(e){
    if(!isDrag)return;
    var p=evXY(e);sign.px=sign.x;sign.py=sign.y;sign.x=p.x+dox;sign.y=p.y+doy;
  });
  window.addEventListener('touchmove',function(e){
    if(!isDrag)return;e.preventDefault();
    var p=evXY(e);sign.px=sign.x;sign.py=sign.y;sign.x=p.x+dox;sign.y=p.y+doy;
  },{passive:false});
  function endDrag(){
    if(!isDrag)return;isDrag=false;hitbox.style.cursor='grab';
    _skipCount=0; _signMoving=true; // pastikan loop aktif setelah dilepas
    // Jika ditarik jauh ke bawah (> 55% viewport height) → slingshot scroll ke top
    var threshold = window.innerHeight * 0.55;
    var pullDist  = sign.y - restY();
    if(pullDist > threshold){
      // Visual: lempar papan balik ke atas dengan cepat
      sign.py = sign.y + pullDist * 0.6; // beri velocity balik ke atas
      // Scroll ke top dengan smooth fast
      window.scrollTo({top:0, behavior:'smooth'});
      // Ripple/flash hint
      var flash = document.createElement('div');
      flash.style.cssText='position:fixed;inset:0;background:rgba(184,50,50,0.08);pointer-events:none;z-index:9999;transition:opacity 0.4s';
      document.body.appendChild(flash);
      requestAnimationFrame(function(){ flash.style.opacity='0'; });
      setTimeout(function(){ flash.remove(); }, 450);
    }
  }
  window.addEventListener('mouseup',endDrag);
  window.addEventListener('touchend',endDrag);

  // FIX v116: saat tab di-background, rAF freeze → _loopRunning tetap true
  // tapi loop() tidak pernah dipanggil lagi → papan tidak tampil saat tab kembali aktif.
  // Solusi: reset _loopRunning saat hidden, restart loop saat visible kembali.
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      _loopRunning = false; // izinkan restart saat tab kembali
    } else {
      // Tab kembali aktif — bangunkan loop & refresh anchor (bisa berubah saat hidden)
      _anchorDirty = true;
      _skipCount = 0;
      _signMoving = true;
      startLoop();
    }
  });

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){init();startLoop();});
  });
})();
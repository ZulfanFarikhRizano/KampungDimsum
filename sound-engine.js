(function(){
'use strict';
var LOW  = window._KD_LOW;
var MID  = window._KD_MID;
var HIGH = window._KD_HIGH;

/* ══════════════════ SOUND ENGINE v4 ══════════════════
   Root cause delay:
   - AudioContext suspended by browser policy until gesture
   - Buffer rendering happens ON first click (too late)
   
   Fix:
   - Pre-render ALL buffers using OfflineAudioContext (no gesture needed)
   - Store as Float32Array (raw PCM) — no AudioContext required
   - On gesture: create AudioContext ONCE, decode stored PCM instantly
   - Play = createBuffer + copyToChannel + start → <0.5ms
   ══════════════════════════════════════════════════════ */
var _actx=null, _soundOn=false, _masterGain=null;
var _pcmClick=null, _pcmWhoosh=null, _pcmSuccess=null;
var _SR = 22050; // sample rate — cukup untuk UI sounds, lebih ringan dari 44100

/* Step 1: Pre-compute PCM saat halaman load — tidak butuh gesture */
(function precompute(){
  var sr = _SR;
  function makePCM(fn, dur){
    var len = Math.floor(sr * dur);
    var d = new Float32Array(len);
    fn(d, sr, dur);
    return d;
  }

  /* Click: high-pitched tap */
  _pcmClick = makePCM(function(d, sr, dur){
    for(var i=0;i<d.length;i++){
      var t=i/sr, env=Math.pow(1-t/dur,3);
      d[i]=(Math.sin(2*Math.PI*900*t)+Math.sin(2*Math.PI*1350*t)*0.4)*env*0.12;
    }
  }, 0.05);

  /* Whoosh: soft swoosh */
  _pcmWhoosh = makePCM(function(d, sr, dur){
    for(var i=0;i<d.length;i++){
      var t=i/sr, env=Math.pow(1-t/dur,2);
      d[i]=(Math.sin(2*Math.PI*(500-t*800)*t))*env*0.08;
    }
  }, 0.08);

  /* Success: two-note chime */
  _pcmSuccess = makePCM(function(d, sr, dur){
    for(var i=0;i<d.length;i++){
      var t=i/sr, env=Math.pow(1-t/dur,2);
      var note = t < 0.06 ? 660 : 880;
      d[i]=Math.sin(2*Math.PI*note*t)*env*0.1;
    }
  }, 0.13);
})();

/* Step 2: Create AudioContext on first gesture */
function _unlockCtx(){
  if(_actx) return;
  try{
    _actx = new(window.AudioContext||window.webkitAudioContext)({sampleRate:_SR});
    _masterGain = _actx.createGain();
    _masterGain.gain.value = 0; /* mulai mute — aktif saat user toggle ON */
    _masterGain.connect(_actx.destination);
  }catch(e){}
}

/* Step 3: Play — copy PCM ke buffer, start */
var _lastPlayTs = 0;
var _PLAY_COOLDOWN = 80; // ms — cegah double-fire dari ripple + direct call pada event yang sama
function _play(pcm){
  if(!_soundOn||!_actx||!pcm) return;
  var now = Date.now();
  if(now - _lastPlayTs < _PLAY_COOLDOWN) return; // drop jika terlalu dekat
  _lastPlayTs = now;
  if(_actx.state==='suspended') _actx.resume();
  try{
    var buf = _actx.createBuffer(1, pcm.length, _SR);
    buf.copyToChannel(pcm, 0);
    var src = _actx.createBufferSource();
    src.buffer = buf;
    src.connect(_masterGain);
    src.start(0); /* start=0 → "play asap" */
  }catch(e){}
}

function _click()  { _play(_pcmClick);   }
function _whoosh() { _play(_pcmWhoosh);  }
function _success(){ _play(_pcmSuccess); }

window.kdToggleSound = function(btn){
  /* Jika context belum ada, buat sekarang (ini adalah gesture) */
  if(!_actx) _unlockCtx();
  if(_actx && _actx.state==='suspended') _actx.resume();

  _soundOn = !_soundOn;
  if(_masterGain){
    _masterGain.gain.cancelScheduledValues(_actx.currentTime);
    _masterGain.gain.setValueAtTime(_soundOn ? 1 : 0, _actx.currentTime);
  }
  btn.classList.toggle('active', _soundOn);
  document.getElementById('sound-icon-on').style.display  = _soundOn ? '' : 'none';
  document.getElementById('sound-icon-off').style.display = _soundOn ? 'none' : '';
  if(_soundOn) setTimeout(function(){ _play(_pcmSuccess); }, 10);
};

/* Unlock AudioContext di gesture pertama — capture phase, paling awal */
function _gestureUnlock(){
  _unlockCtx();
  if(_actx && _actx.state==='suspended') _actx.resume();
}
document.addEventListener('touchstart', _gestureUnlock, {once:true, passive:true, capture:true});
document.addEventListener('mousedown',  _gestureUnlock, {once:true, passive:true, capture:true});
document.addEventListener('pointerdown',_gestureUnlock, {once:true, passive:true, capture:true});

/* ══════════════════ 3. RIPPLE ══════════════════ */
document.addEventListener('click',function(e){
  var btn=e.target.closest('.btn-primary,.btn-outline,.nav-cta,.btn-save,.btn-lihat-menu,.btn-admin');
  if(!btn)return;
  _click();
  var r=btn.getBoundingClientRect();
  var sz=Math.max(r.width,r.height)*1.6;
  var el=document.createElement('span');
  el.className='kd-ripple';
  el.style.cssText='width:'+sz+'px;height:'+sz+'px;left:'+(e.clientX-r.left-sz/2)+'px;top:'+(e.clientY-r.top-sz/2)+'px';
  var pos=window.getComputedStyle(btn).position;
  if(pos==='static')btn.style.position='relative';
  btn.style.overflow='hidden';
  btn.appendChild(el);
  setTimeout(function(){el.remove();},600);
},{passive:true});

/* ══════════════════ 4. TYPING EFFECT ══════════════════ */
(function(){
  if(LOW)return;
  var el=document.querySelector('.hero-eyebrow');
  if(!el)return;
  var phrases=['Authentic Chinese Street Food','Dimsum Segar, Topping Berlimpah','15+ Cabang di Jabodetabek','Nikmati Kebaikan di Setiap Suapan'];
  var cursor=document.createElement('span');cursor.className='typing-cursor';
  var txt=document.createTextNode(el.textContent.trim());
  el.textContent='';el.appendChild(txt);el.appendChild(cursor);
  var pi=0,ci=phrases[0].length,del=true,timer;
  function tick(){
    var ph=phrases[pi];
    if(del){ci--;txt.textContent=ph.slice(0,ci);if(ci===0){del=false;pi=(pi+1)%phrases.length;timer=setTimeout(tick,320);return;}}
    else{ci++;txt.textContent=ph.slice(0,ci);if(ci===ph.length){del=true;timer=setTimeout(tick,2200);return;}}
    timer=setTimeout(tick,del?36:70);
  }
  setTimeout(function(){del=true;ci=phrases[0].length;tick();},2800);
})();

/* ══════════════════ 5. PARTICLES ══════════════════ */
(function(){
  if(LOW)return;
  var hero=document.getElementById('hero');
  if(!hero)return;
  var cv=document.createElement('canvas');
  cv.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.4';
  hero.style.position=hero.style.position||'relative';
  hero.insertBefore(cv,hero.firstChild);
  var ctx2=cv.getContext('2d');
  var W,H,pts=[];
  var N=MID?20:36;
  function rsz(){W=cv.width=hero.offsetWidth;H=cv.height=hero.offsetHeight;}
  rsz();
  window.addEventListener('resize',function(){setTimeout(rsz,200);},{passive:true});
  function mkPt(){return{x:Math.random()*W,y:H+5,r:Math.random()*2+.8,vx:(Math.random()-.5)*.4,vy:-(Math.random()*.5+.2),life:0,max:Math.random()*.4+.3,c:Math.random()<.6?'184,50,50':'212,168,58'};}
  for(var i=0;i<N;i++){var p=mkPt();p.y=Math.random()*H;p.life=Math.random()*p.max;pts.push(p);}
  var raf2;
  function draw2(){
    ctx2.clearRect(0,0,W,H);
    for(var i=0;i<pts.length;i++){
      var p=pts[i];p.x+=p.vx;p.y+=p.vy;p.life+=.004;
      if(p.life>=p.max||p.y<-5){pts[i]=mkPt();continue;}
      var prog=p.life/p.max;
      var a=prog<.2?prog/.2:prog>.8?(1-prog)/.2:1;
      ctx2.globalAlpha=a*.5;
      ctx2.fillStyle='rgba('+p.c+',1)';
      ctx2.beginPath();ctx2.arc(p.x,p.y,p.r,0,Math.PI*2);ctx2.fill();
    }
    ctx2.globalAlpha=1;
    raf2=requestAnimationFrame(draw2);
  }
  draw2();
  var io2=new IntersectionObserver(function(en){if(en[0].isIntersecting){if(!raf2)draw2();}else{cancelAnimationFrame(raf2);raf2=null;}},{threshold:0});
  io2.observe(hero);
})();

/* ══════════════════ 6. CURSOR TRAIL ══════════════════ */
(function(){
  if(LOW||MID)return;
  if(window.matchMedia('(hover:none)').matches)return;
  var N=8,dots=[];
  for(var i=0;i<N;i++){
    var d=document.createElement('div');d.className='kd-cursor-trail';
    var s=9-i,a=(1-i/N).toFixed(2);
    d.style.cssText='width:'+s+'px;height:'+s+'px;'+(i<3?'background:rgba(184,50,50,'+a+')':'background:rgba(212,168,58,'+a+')');
    document.body.appendChild(d);dots.push({el:d,x:0,y:0});
  }
  var mx=0,my=0,px=Array(N).fill(0),py=Array(N).fill(0);
  document.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;dots[0].el.style.opacity='.9';},{passive:true});
  document.addEventListener('mouseleave',function(){dots.forEach(function(d){d.el.style.opacity='0';});},{passive:true});
  function loop2(){
    px[0]=mx;py[0]=my;
    for(var i=1;i<N;i++){px[i]+=(px[i-1]-px[i])*.35;py[i]+=(py[i-1]-py[i])*.35;dots[i].el.style.left=px[i]+'px';dots[i].el.style.top=py[i]+'px';dots[i].el.style.opacity=String(1-i/N*.85);}
    dots[0].el.style.left=px[0]+'px';dots[0].el.style.top=py[0]+'px';
    requestAnimationFrame(loop2);
  }
  requestAnimationFrame(loop2);
})();

/* ══════════════════ 7. TESTIMONI CAROUSEL ══════════════════ */
(function(){
  /* Expose initTestiCarousel agar bisa dipanggil ulang setelah renderTestimoni() */
  window.initTestiCarousel = function(){
    var grid = document.getElementById('testi-grid');
    if(!grid) return;

    /* Hapus carousel lama jika ada (re-init) */
    var oldTrack = grid.querySelector('.testi-track');
    if(oldTrack){
      /* Kembalikan kartu ke grid dulu sebelum rebuild */
      Array.from(oldTrack.children).forEach(function(c){ grid.appendChild(c); });
      oldTrack.remove();
    }
    var oldNav = grid.parentNode && grid.parentNode.querySelector('.testi-nav');
    if(oldNav) oldNav.remove();

    var cards = Array.from(grid.querySelectorAll('.testi-card'));
    if(!cards.length) return;

    /* Set lebar kartu = lebar grid dibagi jumlah kartu visible, dengan gap */
    function setCardWidths(){
      var v    = vc();
      var gapTotal = 20 * (v - 1);
      var w    = (grid.offsetWidth - gapTotal) / v;
      cards.forEach(function(c){
        c.style.width    = w + 'px';
        c.style.minWidth = w + 'px';
        c.style.maxWidth = w + 'px';
      });
    }
    setCardWidths();
    window.addEventListener('resize', function(){
      setCardWidths();
      go(cur); /* re-calculate offset setelah resize */
    }, {passive:true});

    /* Bungkus dalam track */
    var track = document.createElement('div');
    track.className = 'testi-track';
    cards.forEach(function(c){ track.appendChild(c); });
    grid.appendChild(track);

    var total = cards.length, cur = 0, timer;

    function vc(){ var w=window.innerWidth; return w<=600?1:w<=900?2:3; }

    /* Nav */
    var nav  = document.createElement('div'); nav.className='testi-nav';
    var prev = document.createElement('button'); prev.className='testi-nav-btn';
    prev.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="15,18 9,12 15,6"/></svg>';
    var next = document.createElement('button'); next.className='testi-nav-btn';
    next.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="9,18 15,12 9,6"/></svg>';
    var dw = document.createElement('div'); dw.style.cssText='display:flex;gap:6px;align-items:center;';
    var dotEls = [];
    for(var i=0;i<total;i++){
      var dot=document.createElement('button'); dot.className='testi-nav-dot';
      (function(idx){ dot.addEventListener('click',function(){ go(idx); reset(); }); })(i);
      dw.appendChild(dot); dotEls.push(dot);
    }
    nav.appendChild(prev); nav.appendChild(dw); nav.appendChild(next);
    grid.parentNode.insertBefore(nav, grid.nextSibling);

    function go(idx){
      cur = (idx+total)%total;
      requestAnimationFrame(function(){
        var cardW = (parseFloat(cards[0].style.width)||cards[0].getBoundingClientRect().width||280) + 20;
        var maxO  = Math.max(0, total - vc());
        track.style.transform = 'translateX(-' + (Math.min(cur,maxO)*cardW) + 'px)';
        dotEls.forEach(function(d,i){ d.classList.toggle('active',i===cur); });
        if(typeof _whoosh === 'function') _whoosh();
      });
    }
    function reset(){
      clearInterval(timer);
      timer = setInterval(function(){ go(cur+1); }, 4500);
    }
    prev.addEventListener('click', function(){ go(cur-1); reset(); });
    next.addEventListener('click', function(){ go(cur+1); reset(); });
    go(0); reset();

    grid.addEventListener('mouseenter', function(){ clearInterval(timer); });
    grid.addEventListener('mouseleave', function(){ reset(); });

    /* Swipe */
    var tx0;
    track.addEventListener('touchstart', function(e){ tx0=e.touches[0].clientX; },{passive:true});
    track.addEventListener('touchend',   function(e){
      if(tx0==null)return;
      var dx=e.changedTouches[0].clientX-tx0;
      if(Math.abs(dx)>40){ go(dx<0?cur+1:cur-1); reset(); }
      tx0=null;
    },{passive:true});
  };

  /* Init awal — tunggu renderTestimoni selesai */
  setTimeout(window.initTestiCarousel, 400);
})();

/* Patch renderTestimoni agar re-init carousel setelah render */
(function(){
  var orig = window.renderTestimoni;
  if(!orig) return;
  window.renderTestimoni = function(){
    orig.apply(this, arguments);
    /* Re-init setelah DOM update selesai */
    requestAnimationFrame(function(){
      setTimeout(window.initTestiCarousel, 50);
    });
  };
})();

/* ══════════════════ 8. LIVE VISITOR ══════════════════ */
(function(){
  var badge=document.getElementById('live-visitor-badge');
  var cnt=document.getElementById('live-count');
  if(!badge||!cnt)return;
  var n=38+Math.floor(Math.random()*22);
  cnt.textContent=n;
  setTimeout(function(){badge.classList.add('show');},2200);
  function upd(){n=Math.max(18,Math.min(120,n+Math.floor(Math.random()*5)-1));cnt.textContent=n;setTimeout(upd,5000+Math.random()*7000);}
  setTimeout(upd,6000);
})();

/* ══════════════════ 9. PROMO COUNTDOWN ══════════════════ */
(function(){
  function injectCD(){
    var cards=document.querySelectorAll('.promo-card');
    if(!cards.length){setTimeout(injectCD,1200);return;}
    var offsets=[6*3600+1800,23*3600+3600,47*3600+900];
    cards.forEach(function(card,i){
      if(card.querySelector('.kd-countdown'))return;
      var secs=offsets[i%offsets.length];
      var end=Date.now()+secs*1000;
      var wrap=document.createElement('div');wrap.className='kd-countdown';
      wrap.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>Berakhir dalam <b class="kd-cd-v">—</b></span>';
      card.appendChild(wrap);
      var v=wrap.querySelector('.kd-cd-v');
      function tick(){var rem=Math.max(0,Math.floor((end-Date.now())/1000));var h=Math.floor(rem/3600);var m=Math.floor((rem%3600)/60);var s=rem%60;v.textContent=(h?h+'j ':'')+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'d';if(rem>0)setTimeout(tick,1000);else v.textContent='Promo berakhir';}
      tick();
    });
  }
  setTimeout(injectCD,1400);
})();

/* ══════════════════ PERF v96: OFF-SCREEN ANIMATION PAUSER ══════════════════
   Semua section diberi .anim-paused saat tidak terlihat.
   Satu IntersectionObserver untuk semua section — hemat memory. */
(function(){
  if(LOW) return; // low-end sudah matikan semua via CSS
  var targets = document.querySelectorAll('section, #hero, #main-nav, footer');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      en.target.classList.toggle('anim-paused', !en.isIntersecting);
    });
  }, {rootMargin:'120px 0px 120px 0px', threshold:0});
  targets.forEach(function(t){ io.observe(t); });
})();

/* ── Particles canvas: hanya render saat hero visible ── */
/* (sudah ada IntersectionObserver di particles block, ini sudah oke) */



/* ─── A. DARK / LIGHT MODE TOGGLE ─── */
(function(){
  var stored=localStorage.getItem('kd-theme');
  var root=document.documentElement;
  /* apply saved theme before paint */
  if(stored==='light') root.setAttribute('data-theme','light');

  /* Inject toggle button into navbar */
  function injectToggle(){
    var nav=document.querySelector('.nav-actions');
    if(!nav){setTimeout(injectToggle,300);return;}
    if(document.getElementById('kd-theme-btn'))return;
    var btn=document.createElement('button');
    btn.id='kd-theme-btn';
    btn.className='nav-theme-btn';
    btn.title='Ganti Tema';
    btn.setAttribute('aria-label','Toggle tema');
    btn.innerHTML=root.getAttribute('data-theme')==='light'
      ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round"/></svg>'
      :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.addEventListener('click',function(){
      var isDark=root.getAttribute('data-theme')!=='light';
      root.setAttribute('data-theme',isDark?'light':'dark');
      localStorage.setItem('kd-theme',isDark?'light':'dark');
      btn.innerHTML=isDark
        ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round"/></svg>'
        :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      /* ripple burst */
      root.style.transition='background .4s,color .4s';
      _click();
    });
    /* insert before first child */
    nav.insertBefore(btn,nav.firstChild);
  }
  injectToggle();
})();

/* ─── B. HERO AURORA GRADIENT ─── */
(function(){
  if(LOW)return;
  var hero=document.getElementById('hero');
  if(!hero)return;
  var aurora=document.createElement('div');
  aurora.id='kd-aurora';
  aurora.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;opacity:.18;';
  aurora.innerHTML='<div class="aurora-blob a1"></div><div class="aurora-blob a2"></div><div class="aurora-blob a3"></div>';
  hero.insertBefore(aurora,hero.firstChild);
})();

/* ─── C. CONFETTI on form submit ─── */
window.kdConfetti=function(){
  if(LOW)return;
  var colors=['#B83232','#D4A83A','#fff','#E8604A','#F5D78E'];
  for(var i=0;i<55;i++){
    (function(){
      var el=document.createElement('div');
      el.className='kd-confetti-piece';
      var color=colors[Math.floor(Math.random()*colors.length)];
      var left=Math.random()*100;
      var size=Math.random()*8+5;
      var delay=Math.random()*0.6;
      var dur=Math.random()*1.2+1.2;
      var rot=Math.random()*720-360;
      el.style.cssText='position:fixed;top:-20px;left:'+left+'vw;'
        +'width:'+size+'px;height:'+(size*0.55)+'px;'
        +'background:'+color+';border-radius:2px;z-index:9999;pointer-events:none;'
        +'animation:confettiFall '+dur+'s '+delay+'s ease-in forwards;'
        +'transform:rotate('+rot+'deg);';
      document.body.appendChild(el);
      setTimeout(function(){el.remove();},((delay+dur)*1000)+200);
    })();
  }
  _success();
};

/* ─── D. STICKY ORDER FLOAT BUTTON — popup 3 pilihan ─── */
(function(){
  /* Wrapper */
  var wrap=document.createElement('div');
  wrap.id='kd-order-wrap';

  /* Popup menu */
  wrap.innerHTML=
    '<div id="kd-order-popup">'
      +'<a class="kd-op-item kd-op-wa" href="https://wa.me/6285133355583?text=Halo%2C%20saya%20mau%20pesan%20Dimsum%20Kampung%20Dimsum%20%F0%9F%A5%9F" target="_blank" rel="noopener">'
        +'<span class="kd-op-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.083.535 4.04 1.473 5.741L.057 23.882l6.27-1.645A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.01-1.376l-.36-.213-3.724.976.994-3.632-.234-.374A9.818 9.818 0 1112 21.818z"/></svg></span>'
        +'<span class="kd-op-label">WhatsApp</span>'
      +'</a>'
      +'<a class="kd-op-item kd-op-grab" href="https://r.grab.com/g/6-20260521_085615_3b55e36da58f4a368553a4f968ffbcaa_MEXMPS-6-C7XZNYDGA72GPE" target="_blank" rel="noopener">'
        +'<span class="kd-op-icon"><img src="data:image/png;base64,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" alt="GrabFood" height="20" style="height:20px;width:auto;display:block"></span>'
        +'<span class="kd-op-label">GrabFood</span>'
      +'</a>'
      +'<a class="kd-op-item kd-op-gofood" href="https://gofood.link/a/SvmvCkw" target="_blank" rel="noopener">'
        +'<span class="kd-op-icon"><img src="data:image/png;base64,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" alt="GoFood" height="20" style="height:20px;width:auto;display:block"></span>'
        +'<span class="kd-op-label">GoFood</span>'
      +'</a>'
    +'</div>'
    /* Main trigger button */
    +'<button id="kd-order-btn" aria-label="Pesan sekarang" aria-expanded="false">'
      +'<span id="kd-ob-icon">'
        +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="22" height="22" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>'
      +'</span>'
      +'<span id="kd-ob-label">Pesan Sekarang</span>'
    +'</button>';

  document.body.appendChild(wrap);

  var btn   = document.getElementById('kd-order-btn');
  var popup = document.getElementById('kd-order-popup');
  var open  = false;

  function togglePopup(force){
    open = (force !== undefined) ? force : !open;
    popup.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    btn.classList.toggle('active', open);
    if(open) _click();
  }

  btn.addEventListener('click', function(e){
    e.stopPropagation();
    togglePopup();
  });

  /* Klik di luar = tutup */
  document.addEventListener('click', function(e){
    if(open && !wrap.contains(e.target)) togglePopup(false);
  });

  /* Tutup saat pilih opsi */
  popup.querySelectorAll('.kd-op-item').forEach(function(a){
    a.addEventListener('click', function(){ _click(); setTimeout(function(){ togglePopup(false); }, 200); });
  });

  /* Show/hide saat scroll melewati menu section */
  var menuSec = document.getElementById('menu');
  if(menuSec){
    var waIo = new IntersectionObserver(function(entries){
      wrap.classList.toggle('show', !entries[0].isIntersecting && window.scrollY > 300);
    }, {threshold:0});
    waIo.observe(menuSec);
  }
})();

/* ─── F. ANIMATED STAR RATINGS on viewport enter ─── */
(function(){
  var done=new Set();
  var io3=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting||done.has(en.target))return;
      done.add(en.target);
      var stars=en.target.querySelectorAll('.star-fill,[class*="star"]');
      stars.forEach(function(s,i){
        s.style.opacity='0';s.style.transform='scale(0)';
        setTimeout(function(){
          s.style.transition='opacity .3s,transform .3s cubic-bezier(.34,1.56,.64,1)';
          s.style.opacity='1';s.style.transform='scale(1)';
        },i*90);
      });
    });
  },{threshold:0.3});
  function scanRatings(){
    document.querySelectorAll('.testi-card,.stat-row,[class*="rating"]').forEach(function(el){
      if(!done.has(el))io3.observe(el);
    });
  }
  setTimeout(scanRatings,1200);
})();

/* ─── H. PROMO CODE COPY ─── */
(function(){
  function injectCopyBtns(){
    var cards=document.querySelectorAll('.promo-card');
    if(!cards.length){setTimeout(injectCopyBtns,1400);return;}
    var codes=['DIMSUM10','KAMPUNG15','NEWMEMBER','HAPPYHOUR'];
    cards.forEach(function(card,i){
      if(card.querySelector('.kd-copy-code'))return;
      var code=codes[i%codes.length];
      var wrap=document.createElement('div');
      wrap.className='kd-copy-code';
      wrap.innerHTML='<span class="kcc-label">Kode Promo:</span>'
        +'<code class="kcc-code">'+code+'</code>'
        +'<button class="kcc-btn" data-code="'+code+'" title="Salin kode">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
          +'<span>Salin</span>'
        +'</button>';
      card.appendChild(wrap);
      wrap.querySelector('.kcc-btn').addEventListener('click',function(){
        var btn2=this;
        navigator.clipboard&&navigator.clipboard.writeText(code).then(function(){
          btn2.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20,6 9,17 4,12"/></svg><span>Disalin!</span>';
          btn2.classList.add('copied');
          _success();
          setTimeout(function(){
            btn2.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span>Salin</span>';
            btn2.classList.remove('copied');
          },2000);
        });
      });
    });
  }
  setTimeout(injectCopyBtns,1600);
})();

/* ─── I. NEAREST BRANCH DETECTOR (Geolocation) ─── */
(function(){
  if(!navigator.geolocation)return;
  /* Wait for cabang grid to render */
  function tryDetect(){
    var cabangGrid=document.getElementById('cabang-grid');
    if(!cabangGrid||!window._KD_BRANCHES){setTimeout(tryDetect,1500);return;}
    /* Inject "Cari Terdekat" button near cabang search */
    var searchWrap=document.querySelector('.cabang-search');
    if(!searchWrap||document.getElementById('kd-nearest-btn'))return;
    var btn=document.createElement('button');
    btn.id='kd-nearest-btn';
    btn.className='btn-outline kd-nearest-btn';
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Terdekat';
    btn.addEventListener('click',function(){
      _click();
      btn.disabled=true;btn.textContent='Mencari...';
      navigator.geolocation.getCurrentPosition(function(pos){
        var lat=pos.coords.latitude,lng=pos.coords.longitude;
        var branches=window._KD_BRANCHES||[];
        var best=null,bestD=Infinity;
        branches.forEach(function(b){
          if(!b.lat||!b.lng)return;
          var dLat=(b.lat-lat)*Math.PI/180,dLng=(b.lng-lng)*Math.PI/180;
          var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
          var d=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
          if(d<bestD){bestD=d;best=b;}
        });
        btn.disabled=false;
        btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Terdekat';
        if(best){
          /* Highlight card */
          document.querySelectorAll('.cabang-card').forEach(function(c){c.classList.remove('kd-nearest-highlight');});
          var target=Array.from(document.querySelectorAll('.cabang-card')).find(function(c){
            return c.textContent.includes(best.name||best.nama||'');
          });
          if(target){
            target.classList.add('kd-nearest-highlight');
            target.scrollIntoView({behavior:'smooth',block:'center'});
            kdShowToastV95('📍 Cabang terdekat: '+(best.name||best.nama||'—')+' (±'+bestD.toFixed(1)+' km)','info');
          }
        } else { kdShowToastV95('Tidak dapat menemukan cabang terdekat','warn'); }
      },function(){
        btn.disabled=false;
        btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Terdekat';
        kdShowToastV95('Izin lokasi ditolak','warn');
      },{timeout:8000});
    });
    searchWrap.appendChild(btn);
  }
  setTimeout(tryDetect,2000);
})();

/* ─── J. CONFETTI on franchise / kontak submit ─── */
(function(){
  var origSubmit=window.submitFranchise;
  if(origSubmit) window.submitFranchise=function(){
    origSubmit.apply(this,arguments);
    setTimeout(window.kdConfetti,600);
  };
  var origKontak=window.submitKontak;
  if(origKontak) window.submitKontak=function(){
    origKontak.apply(this,arguments);
    setTimeout(window.kdConfetti,600);
  };
})();

/* ─── K. HELPER toast untuk v95 ─── */
window.kdShowToastV95=function(msg,type){
  var t=document.createElement('div');
  t.className='kd-toast-v95 kd-toast-v95--'+(type||'info');
  t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show');});});
  setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove();},350);},3000);
};

})(); /* end IIFE */

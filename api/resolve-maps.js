// api/resolve-maps.js
// Tujuan: admin cukup tempel link Google Maps (termasuk link pendek maps.app.goo.gl/...),
// fungsi ini follow redirect-nya DI SERVER (browser tidak bisa karena dibatasi CORS),
// lalu ekstrak koordinat lat/lng dari URL hasil redirect.
//
// Dipakai oleh: catalog-analytics.js -> btnAmbilKoordinat() / cbResolveMaps()
// Endpoint: GET /api/resolve-maps?url=<link_google_maps>

const ALLOWED_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'google.com',
  'maps.google.com',
  'www.google.co.id',
  'google.co.id'
];

function extractLatLng(urlStr) {
  // Pola 1: .../@-6.425067,106.742754,17z...  (paling umum, ada di hampir semua link Maps)
  let m = urlStr.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Pola 2: !3d-6.425067!4d106.742754  (koordinat presisi tinggi, kadang dipakai Google internal)
  m = urlStr.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Pola 3: ?q=-6.425067,106.742754 atau &query=-6.425067,106.742754
  m = urlStr.match(/[?&](?:q|query)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawUrl = (req.query.url || '').trim();
  if (!rawUrl) {
    res.status(400).json({ error: 'Parameter url wajib diisi' });
    return;
  }

  let target;
  try {
    target = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
  } catch (e) {
    res.status(400).json({ error: 'Format link tidak valid' });
    return;
  }

  // SSRF guard: hanya izinkan domain Google Maps yang dikenal — jangan biarkan
  // endpoint ini dipakai untuk fetch sembarang URL internal/eksternal.
  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    res.status(400).json({ error: 'Link harus dari Google Maps (maps.app.goo.gl / google.com/maps)' });
    return;
  }

  try {
    // Coba langsung dari link yang dikasih (kalau sudah link panjang, biasanya sudah ada koordinat)
    let found = extractLatLng(target.href);

    if (!found) {
      // Follow redirect manual sampai habis (maks 5 hop, hindari infinite redirect loop)
      let current = target.href;
      let finalUrl = current;
      for (let i = 0; i < 5; i++) {
        const resp = await fetch(current, { redirect: 'manual' });
        const loc = resp.headers.get('location');
        if (!loc) { finalUrl = current; break; }
        current = new URL(loc, current).href;
        finalUrl = current;
        if (resp.status < 300 || resp.status >= 400) break;
      }
      found = extractLatLng(finalUrl);

      // Fallback terakhir: kalau redirect tidak ketemu koordinat di URL,
      // coba fetch isi HTML halaman akhir (kadang koordinat cuma ada di body, bukan URL)
      if (!found) {
        const resp2 = await fetch(finalUrl, { redirect: 'follow' });
        found = extractLatLng(resp2.url);
        if (!found) {
          const html = await resp2.text();
          found = extractLatLng(html);
        }
      }
    }

    if (!found) {
      res.status(404).json({ error: 'Koordinat tidak ditemukan dari link ini — isi manual saja' });
      return;
    }

    res.status(200).json({ lat: found.lat, lng: found.lng });
  } catch (err) {
    console.error('[resolve-maps] error:', err.message);
    res.status(500).json({ error: 'Gagal memproses link, coba lagi atau isi manual' });
  }
}

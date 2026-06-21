// api/delete-user.js — Vercel Serverless Function
// Menghapus user dari Supabase Auth menggunakan service_role key.
// PENTING: SUPABASE_SERVICE_ROLE_KEY hanya boleh dipakai di sini (server), JANGAN PERNAH
// dikirim/diekspos ke browser/client.
//
// Supabase Admin API tidak punya cara resmi untuk cari user "by username/email",
// jadi endpoint ini butuh `id` (Supabase Auth user id) dari client.
// Di kode v138, variabel ini sudah ada sebagai `targetId` tepat sebelum fetch('/api/delete-user'),
// cukup tambahkan `id: targetId` ke body request dari sisi client.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    res.status(500).json({ error: 'Env var SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { id, username } = body || {};

  if (!id) {
    // Tidak fatal di sisi app (profil di admin_profiles sudah terhapus duluan),
    // tapi tanpa id kita tidak bisa hapus akun di Supabase Auth dengan aman.
    res.status(400).json({
      error: 'id (Supabase Auth user id) wajib dikirim. username="' + (username || '') + '" tidak cukup untuk mencari user di Auth.'
    });
    return;
  }

  try {
    const resp = await fetch(url + '/auth/v1/admin/users/' + id, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey
      }
    });

    if (!resp.ok) {
      const data = await resp.json().catch(function () { return {}; });
      res.status(resp.status).json({
        error: data.msg || data.error_description || data.error || 'Gagal menghapus user di Supabase Auth'
      });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

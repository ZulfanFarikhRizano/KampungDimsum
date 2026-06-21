// api/create-user.js — Vercel Serverless Function
// Membuat user di Supabase Auth (bypass konfirmasi email) menggunakan service_role key.
// PENTING: SUPABASE_SERVICE_ROLE_KEY hanya boleh dipakai di sini (server), JANGAN PERNAH
// dikirim/diekspos ke browser/client.

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
  const { email, password, display_name, role } = body || {};

  if (!email || !password) {
    res.status(400).json({ error: 'email dan password wajib diisi' });
    return;
  }

  try {
    const resp = await fetch(url + '/auth/v1/admin/users', {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true, // langsung dianggap terkonfirmasi, tidak perlu klik link email
        user_metadata: { display_name: display_name || '', role: role || '' }
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      res.status(resp.status).json({
        error: data.msg || data.error_description || data.error || 'Gagal membuat user di Supabase Auth'
      });
      return;
    }

    res.status(200).json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

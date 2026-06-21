// api/env.js — Vercel Serverless Function
// Inject Supabase URL + anon key ke window.__KD_ENV agar tidak hardcode di kode client.
// PENTING: jangan pernah pakai SUPABASE_SERVICE_ROLE_KEY di sini — itu khusus server,
// kalau dikirim ke browser bisa bypass semua Row Level Security di Supabase.

module.exports = (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_KEY || '';

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  res.status(200).send(
    'window.__KD_ENV = ' + JSON.stringify({ url: url, key: key }) + ';'
  );
};

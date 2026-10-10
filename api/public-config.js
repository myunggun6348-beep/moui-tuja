// Return browser-safe settings only. Never expose service/admin keys.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  let valid = false;
  try {
    valid = new URL(url).protocol === 'https:' && Boolean(key);
    if (key?.includes('.')) {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      valid = valid && payload.role === 'anon';
    } else valid = valid && key?.startsWith('sb_publishable_');
  } catch { valid = false; }
  return res.status(200).json(valid ? { enabled: true, url, key } : { enabled: false });
};

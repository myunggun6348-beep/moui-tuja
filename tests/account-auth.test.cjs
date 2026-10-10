const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handler = require('../api/public-config.js');
function configResponse(env) {
  const saved = { ...process.env };
  for (const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY']) delete process.env[key];
  Object.assign(process.env, env);
  let value;
  const res = { setHeader() {}, status() { return this; }, json(data) { value = data; } };
  handler({ method: 'GET' }, res);
  process.env = saved; return value;
}
assert.deepEqual(configResponse({}), { enabled: false });
assert.deepEqual(configResponse({ SUPABASE_URL:'https://example.supabase.co', SUPABASE_ANON_KEY:'sb_secret_test' }), { enabled: false });
const jwt = role => 'x.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.x';
assert.equal(configResponse({ SUPABASE_URL:'https://example.supabase.co', SUPABASE_ANON_KEY:jwt('service_role') }).enabled, false);
assert.equal(configResponse({ SUPABASE_URL:'https://example.supabase.co', SUPABASE_ANON_KEY:jwt('anon') }).enabled, true);
assert.equal(configResponse({ SUPABASE_URL:'http://example.supabase.co', SUPABASE_ANON_KEY:jwt('anon') }).enabled, false);

(async () => {
  const storage = new Map(), local = new Map(), calls = [];
  let failRefresh = false;
  const context = {
    window: {}, Date, JSON, Number, Error, URL, Uint8Array, TextEncoder,
    crypto: require('node:crypto').webcrypto, btoa: value=>Buffer.from(value,'binary').toString('base64'),
    sessionStorage: { getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k) },
    localStorage: { getItem:k=>local.get(k)||null, setItem:(k,v)=>local.set(k,v), removeItem:k=>local.delete(k) },
    location: { href:'https://app.example/login.html', origin:'https://app.example', assign() {} },
    history: { replaceState() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      let data = {}, status = 200;
      if (url === '/api/public-config') data = { enabled: true, url:'https://example.supabase.co', key:'public-test-key' };
      else if (url.endsWith('/verify')) data = { access_token:'access1', refresh_token:'refresh1', expires_in:1 };
      else if (url.includes('grant_type=pkce')) data = { access_token:'access-pkce', refresh_token:'refresh-pkce', expires_in:3600 };
      else if (url.includes('grant_type=refresh_token')) {
        if (failRefresh) { status = 401; data = { error_code:'refresh_token_not_found' }; }
        else data = { access_token:'access2', refresh_token:'refresh2', expires_in:3600 };
      } else if (url.endsWith('/user')) data = { id:'user-test', email:'fictional@example.com' };
      return { ok:status<400, status, json:async()=>data };
    }
  };
  vm.runInNewContext(fs.readFileSync('prototypes/auth.js','utf8'), context);
  const auth = context.window.AccountAuth;
  await auth.configuration;
  await assert.rejects(auth.token(), /로그인이 필요/);
  await auth.sendCode('fictional@example.com');
  const otp = calls.find(c=>c.url.endsWith('/otp'));
  assert.deepEqual(JSON.parse(otp.options.body), { email:'fictional@example.com', create_user:true });
  await auth.verify('fictional@example.com', '000000');
  assert.equal(storage.get('moui-tuja.mode'), 'account');
  assert.ok(!storage.get('moui-tuja.account.session.v1').includes('fictional@example.com'));
  assert.deepEqual(await Promise.all([auth.token(), auth.token()]), ['access2','access2']);
  assert.equal(calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);
  assert.equal((await auth.user()).id,'user-test');
  await auth.verify('fictional@example.com','000000'); failRefresh = true;
  await assert.rejects(auth.token());
  assert.equal(storage.has('moui-tuja.account.session.v1'),false);
  await auth.sendLink('fictional@example.com');
  const link = calls.find(c=>c.url.includes('/otp?redirect_to='));
  const linkBody = JSON.parse(link.options.body);
  assert.equal(linkBody.code_challenge_method,'s256');
  assert.match(linkBody.code_challenge,/^[a-zA-Z0-9_-]{43}$/);
  const proof = JSON.parse(local.get('moui-tuja.email.pkce.v1'));
  assert.equal(proof.verifier.length,64);
  assert.ok(!JSON.stringify(proof).includes('fictional@example.com'));
  let clearedUrl;
  context.location.href = 'https://app.example/login.html?code=fictional-code';
  context.history.replaceState=(_a,_b,url)=>{clearedUrl=url;};
  vm.runInNewContext(fs.readFileSync('prototypes/auth.js','utf8'),context);
  assert.equal(clearedUrl,'/login.html');
  assert.equal(await context.window.AccountAuth.completeLink(),true);
  assert.equal(local.has('moui-tuja.email.pkce.v1'),false);
  assert.equal(await context.window.AccountAuth.token(),'access-pkce');
  vm.runInNewContext(fs.readFileSync('prototypes/auth.js','utf8'),context);
  await assert.rejects(context.window.AccountAuth.completeLink(),/메일을 요청한 브라우저/);
  console.log('PASS: public-config secrets, OTP, PKCE proof/return URL cleanup, session refresh and expiration');
})().catch(e=>{ console.error(e); process.exitCode=1; });

window.AccountAuth = (() => {
  const sessionKey = 'moui-tuja.account.session.v1';
  const verifierKey = 'moui-tuja.email.pkce.v1';
  const returnUrl = new URL(location.href);
  const returnCode = returnUrl.searchParams.get('code');
  const returnError = returnUrl.searchParams.get('error');
  if (returnCode || returnError) {
    returnUrl.searchParams.delete('code'); returnUrl.searchParams.delete('error');
    returnUrl.searchParams.delete('error_code'); returnUrl.searchParams.delete('error_description');
    history.replaceState(null, '', returnUrl.pathname + returnUrl.search);
  }
  let config, session, refreshPromise;
  const configuration = fetch('/api/public-config', { cache: 'no-store' })
    .then(async r => { if (!r.ok) throw Error(); return r.json(); })
    .then(c => { config = c; return c; })
    .catch(() => { config = { enabled: false }; return config; });
  function save(value) {
    // Tab session only: no password, OTP or email is persisted.
    const normalized = value ? {
      access_token: value.access_token, refresh_token: value.refresh_token,
      expires_at: value.expires_at || Math.floor(Date.now() / 1000) + value.expires_in
    } : null;
    if (normalized) sessionStorage.setItem(sessionKey, JSON.stringify(normalized));
    else sessionStorage.removeItem(sessionKey);
    session = normalized;
  }
  function clear() { session = null; try { sessionStorage.removeItem(sessionKey); } catch {} }
  function message(data, status) {
    if (status === 429) return '요청이 많습니다. 잠시 후 다시 시도하세요.';
    if (['otp_expired', 'otp_disabled'].includes(data.error_code)) return '인증 코드가 만료되었거나 올바르지 않습니다. 새 코드를 받아주세요.';
    if (data.error_code === 'email_address_not_authorized') return '현재 이메일 발송 설정에서는 이 주소로 보낼 수 없습니다. 관리자에게 문의하세요.';
    return '로그인을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도하세요.';
  }
  async function request(path, body, token, method = 'POST') {
    await configuration;
    if (!config.enabled) throw Error('이메일 로그인 연결을 준비 중입니다. 지금은 화면 연습을 이용할 수 있습니다.');
    let r;
    try { r = await fetch(config.url + '/auth/v1/' + path, {
      method, headers: { apikey: config.key, 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    }); } catch { throw Error('연결이 끊겼습니다. 인터넷 연결을 확인하고 다시 시도하세요.'); }
    const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) { const e = Error(message(data, r.status)); e.status = r.status; throw e; }
    return data;
  }
  async function token() {
    if (!session) {
      try { session = JSON.parse(sessionStorage.getItem(sessionKey)); }
      catch { clear(); }
    }
    if (!session?.access_token || !session?.refresh_token || !Number.isFinite(session.expires_at)) {
      clear(); throw Error('로그인이 필요합니다.');
    }
    if (session.expires_at < Date.now() / 1000 + 60) {
      if (!refreshPromise) refreshPromise = request('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(s => { save(s); return s.access_token; })
        .catch(e => { if ([400, 401, 403].includes(e.status)) clear(); throw e; })
        .finally(() => { refreshPromise = null; });
      return refreshPromise;
    }
    return session.access_token;
  }
  async function user() {
    try { return await request('user', null, await token(), 'GET'); }
    catch (e) { if ([401, 403].includes(e.status)) clear(); throw e; }
  }
  async function sendCode(email) { return request('otp', { email, create_user: true }); }
  async function sendLink(email) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    // Temporary proof for opening the link in another tab of the same browser.
    localStorage.setItem(verifierKey, JSON.stringify({ verifier, deadline:Date.now()+3600000 }));
    try { return await request('otp?redirect_to='+encodeURIComponent(location.origin+'/login.html'),
      { email, create_user:true, code_challenge:challenge, code_challenge_method:'s256' }); }
    catch(e) { localStorage.removeItem(verifierKey); throw e; }
  }
  async function completeLink() {
    if (returnError) throw Error('로그인 링크가 만료되었거나 유효하지 않습니다. 새 메일을 받아주세요.');
    if (!returnCode) return false;
    let proof;
    try { proof = JSON.parse(localStorage.getItem(verifierKey)); } catch {}
    if (!proof?.verifier || !Number.isFinite(proof.deadline) || proof.deadline<Date.now()) {
      throw Error('메일을 요청한 브라우저에서 링크를 열어주세요. 이 브라우저에서 새 메일을 받아도 됩니다.');
    }
    const result = await request('token?grant_type=pkce', { auth_code:returnCode, code_verifier:proof.verifier });
    if (!result.access_token || !result.refresh_token) throw Error('로그인을 완료하지 못했습니다.');
    try { save(result); sessionStorage.setItem('moui-tuja.mode','account'); localStorage.removeItem(verifierKey); }
    catch { clear(); throw Error('로그인 정보를 유지할 수 없습니다. 브라우저 저장 권한을 확인하세요.'); }
    return true;
  }
  async function verify(email, code) {
    const result = await request('verify', { email, token: code, type: 'email' });
    if (!result.access_token || !result.refresh_token) throw Error('로그인을 완료하지 못했습니다.');
    try { save(result); sessionStorage.setItem('moui-tuja.mode', 'account'); }
    catch { clear(); throw Error('브라우저에서 로그인 정보를 유지할 수 없습니다. 저장 권한을 확인하세요.'); }
  }
  async function logout() {
    try { await request('logout?scope=local', null, await token()); }
    finally { clear(); sessionStorage.removeItem('moui-tuja.mode'); location.assign('login.html'); }
  }
  return { configuration, token, user, sendCode, sendLink, completeLink, verify, logout, clear };
})();

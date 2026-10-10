const form = document.querySelector('#login-form'), email = document.querySelector('#email');
const status = document.querySelector('#status'), send = document.querySelector('#send-code');
const codeForm = document.querySelector('#code-form'), verify = document.querySelector('#verify-code');
let sentEmail = '', busy = false, nextSend = 0;
function show(message) { status.textContent = message; }
AccountAuth.configuration.then(c => {
  send.disabled = !c.enabled;
  show(c.enabled ? '처음 이용하셔도 이메일 인증으로 시작할 수 있습니다.' : '이메일 로그인과 계정 저장을 연결 중입니다. 아래에서 화면 연습을 이용할 수 있습니다.');
});
form.addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  if (Date.now() < nextSend) return show('인증 메일을 다시 받으려면 60초 정도 기다려 주세요.');
  busy = true; send.disabled = true; show('인증 메일을 보내는 중입니다…');
  try {
    const address = email.value.trim(); await AccountAuth.sendCode(address);
    sentEmail = address; nextSend = Date.now() + 60000;
    document.querySelector('#sent-to').textContent = address + '로 보낸 인증 코드를 입력하세요.';
    codeForm.hidden = false; show('받은편지함과 스팸함을 확인하세요.'); document.querySelector('#code').focus();
  } catch (error) { show(error.message); }
  finally { busy = false; send.disabled = false; }
});
email.addEventListener('input', () => { if (email.value.trim() !== sentEmail) { codeForm.hidden = true; sentEmail = ''; } });
codeForm.addEventListener('submit', async e => {
  e.preventDefault(); if (busy || !sentEmail) return;
  busy = true; verify.disabled = true; show('인증 코드를 확인하는 중입니다…');
  try { await AccountAuth.verify(sentEmail, document.querySelector('#code').value.trim()); location.assign('dashboard.html'); }
  catch (error) { show(error.message); }
  finally { busy = false; verify.disabled = false; }
});
document.querySelector('#demo-start').addEventListener('click', () => {
  try { AccountAuth.clear(); sessionStorage.setItem('moui-tuja.mode', 'demo'); location.assign('dashboard.html'); }
  catch { show('브라우저 저장 권한을 확인하세요.'); }
});

const form = document.querySelector('#login-form'), email = document.querySelector('#email');
const status = document.querySelector('#status'), send = document.querySelector('#send-code');
let busy = false, nextSend = 0;
function show(message) { status.textContent = message; }
(async () => {
 const config = await AccountAuth.configuration;
 if (!config.enabled) return show('이메일 로그인과 계정 저장을 연결 중입니다. 아래에서 화면 연습을 이용할 수 있습니다.');
 try {
   if (await AccountAuth.completeLink()) return location.assign('dashboard.html');
   show('처음 이용하셔도 이메일 인증으로 시작할 수 있습니다.');
 } catch (error) { show(error.message); }
 finally { send.disabled = false; }
})();
form.addEventListener('submit', async e => {
 e.preventDefault(); if (busy) return;
 if (Date.now() < nextSend) return show('메일을 다시 받으려면 60초 정도 기다려 주세요.');
 busy = true; send.disabled = true; show('로그인 메일을 보내는 중입니다…');
 try {
   await AccountAuth.sendLink(email.value.trim()); nextSend = Date.now() + 60000;
   show('메일의 로그인 링크를 눌러주세요. 메일을 요청한 브라우저에서 열어야 합니다. 받은편지함과 스팸함을 확인하세요.');
 } catch (error) { show(error.message); }
 finally { busy = false; send.disabled = false; }
});
document.querySelector('#demo-start').addEventListener('click', () => {
 try { AccountAuth.clear(); sessionStorage.setItem('moui-tuja.mode','demo'); location.assign('dashboard.html'); }
 catch { show('브라우저 저장 권한을 확인하세요.'); }
});

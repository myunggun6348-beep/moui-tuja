// Render cached snapshots; all account writes are validated in Postgres.
window.AppAccount = (() => {
  let cloud = false, cache, polling;
  const listeners = new Set();
  async function rpc(name, body = {}) {
    const c = await AccountAuth.configuration, access = await AccountAuth.token();
    let r;
    try { r = await fetch(c.url + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + access,
        'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }); } catch { throw Error('서버 연결을 확인할 수 없습니다. 저장 결과를 확인한 뒤 다시 주문하세요.'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if ([401, 403].includes(r.status)) { AccountAuth.clear(); throw Error('로그인이 만료됐습니다. 다시 로그인하세요.'); }
      const known = { stale_revision: '다른 기기에서 기록이 바뀌었습니다. 최신 내역을 확인하고 다시 주문하세요.',
        insufficient_cash: '현금이 부족합니다.', insufficient_quantity: '보유 수량보다 많이 팔 수 없습니다.',
        holding_limit: '한 종목의 투자 한도(총자산의 30%)를 넘습니다.',
        order_limit: '연습 주문 저장 한도(1,000건)에 도달했습니다.',
        invalid_order: '주문 내용을 확인하세요.', request_conflict: '같은 주문의 내용이 변경되었습니다. 다시 확인하세요.' };
      throw Error(known[data.message] || '서버에서 기록을 처리하지 못했습니다. 잠시 후 다시 확인하세요.');
    }
    if (!Array.isArray(data.holdings) || data.holdings.length !== 3 || !Array.isArray(data.orders)) throw Error('서버 기록 형식을 확인할 수 없습니다.');
    return data;
  }
  async function refresh() {
    if (!cloud) return DemoStore.read();
    const latest = await rpc('get_practice_account');
    if (!cache || latest.revision >= cache.revision) cache = latest;
    return structuredClone(cache);
  }
  const ready = (async () => {
    let mode;
    try { mode = sessionStorage.getItem('moui-tuja.mode'); }
    catch { throw Error('브라우저 저장 권한을 확인하세요.'); }
    if (mode === 'demo') return;
    const c = await AccountAuth.configuration;
    if (!c.enabled) { location.replace('login.html'); throw Error('이메일 로그인 연결을 준비 중입니다.'); }
    const user = await AccountAuth.user().catch(e => { location.replace('login.html'); throw e; });
    cloud = true; await refresh();
    const demoStore = DemoStore;
    window.DemoStore = { ...demoStore,
      read: () => structuredClone(cache),
      execute: async (order, revision) => {
        cache = await rpc('place_practice_order', {
          p_stock: order.index, p_quantity: order.q, p_side: order.side,
          p_revision: revision, p_request_id: order.id
        });
        listeners.forEach(fn => fn()); return structuredClone(cache);
      },
      subscribe: fn => listeners.add(fn)
    };
    const note = document.querySelector('#account-note');
    if (note) note.textContent = '이메일 계정에 저장되는 모의투자 기록입니다.';
    const demoNote = document.querySelector('.demo');
    if (demoNote) demoNote.textContent = '가상 종목과 예시 가격을 사용하는 모의투자입니다.';
    const bar = document.createElement('div'); bar.className = 'account-bar';
    const label = document.createElement('span'); label.textContent = user.email || '내 계정';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '로그아웃';
    button.addEventListener('click', () => { button.disabled = true; AccountAuth.logout().catch(() => {}); });
    bar.append(label, button); document.querySelector('main').prepend(bar);
    const sync = async () => {
      if (document.hidden || polling) return; polling = true;
      try { const revision = cache.revision; await refresh(); if (cache.revision !== revision) listeners.forEach(fn => fn()); }
      catch (e) { const status = document.querySelector('#save-status, #result, #order-status'); if (status) status.textContent = e.message; }
      finally { polling = false; }
    };
    window.addEventListener('focus', sync); document.addEventListener('visibilitychange', sync); setInterval(sync, 15000);
  })();
  ready.catch(() => {});
  return { ready, refresh, isCloud: () => cloud };
})();

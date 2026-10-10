window.WatchlistStore = (() => {
  const key = 'moui-tuja.watchlist.v1';
  let userId;
  const valid = index => Number.isInteger(index) && index >= 0 && index < 3;
  function decode(value) {
    if (!Array.isArray(value) || value.some(index => !valid(index))) throw Error('관심종목 기록을 읽을 수 없습니다. 기록을 덮어쓰지 않았습니다.');
    return [...new Set(value)];
  }
  async function request(method = 'GET', index) {
    const config = await AccountAuth.configuration, token = await AccountAuth.token();
    userId ||= (await AccountAuth.user()).id;
    if (!userId) throw Error('다시 로그인해 주세요.');
    const params = new URLSearchParams({ user_id: 'eq.' + userId });
    if (method === 'GET') params.set('select', 'stock');
    if (method === 'DELETE') params.set('stock', 'eq.' + index);
    let response;
    try {
      response = await fetch(config.url + '/rest/v1/practice_watchlist?' + params, {
        method, headers: { apikey: config.key, Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json', Prefer: method === 'POST' ? 'resolution=ignore-duplicates,return=minimal' : 'return=minimal' },
        ...(method === 'POST' ? { body: JSON.stringify({ user_id: userId, stock: index }) } : {})
      });
    } catch { throw Error('관심종목 저장 결과를 확인할 수 없습니다. 새로 불러온 뒤 다시 시도하세요.'); }
    if (!response.ok) throw Error(response.status === 401 ? '로그인이 만료됐습니다. 다시 로그인하세요.' : '관심종목을 처리하지 못했습니다. 잠시 후 다시 시도하세요.');
    if (method !== 'GET') return;
    const rows = await response.json();
    return decode(rows.map(row => row.stock));
  }
  async function read() {
    if (AppAccount.isCloud()) return request();
    let raw;
    try { raw = localStorage.getItem(key); }
    catch { throw Error('브라우저에서 관심종목을 읽을 수 없습니다. 저장 권한을 확인하세요.'); }
    if (raw === null) return [];
    try { return decode(JSON.parse(raw)); }
    catch { throw Error('관심종목 기록을 읽을 수 없습니다. 기록을 덮어쓰지 않았습니다.'); }
  }
  async function set(index, selected) {
    if (!valid(index) || typeof selected !== 'boolean') throw Error('종목을 확인하세요.');
    if (AppAccount.isCloud()) { await request(selected ? 'POST' : 'DELETE', index); return read(); }
    if (!navigator.locks) throw Error('최신 브라우저에서 관심종목 저장을 이용해 주세요.');
    return navigator.locks.request(key, async () => {
      const values = new Set(await read());
      if (selected) values.add(index); else values.delete(index);
      try { localStorage.setItem(key, JSON.stringify([...values])); }
      catch { throw Error('관심종목을 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.'); }
      return [...values];
    });
  }
  return { read, set };
})();

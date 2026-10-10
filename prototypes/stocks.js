const $ = id => document.getElementById(id);
let account, favorites = [], onlyFavorites = false, loaded = false, busy = false;
const codes = ['DEMO-A', 'DEMO-B', 'DEMO-C'];
function render() {
  if (!account) return;
  const query = $('search').value.trim().toLocaleLowerCase().replace(/\s+/g, '');
  $('clear-search').hidden = !query;
  $('all-stocks').setAttribute('aria-pressed', String(!onlyFavorites));
  $('favorite-stocks').setAttribute('aria-pressed', String(onlyFavorites));
  $('favorite-count').textContent = loaded ? favorites.length : '—';
  $('list-title').textContent = onlyFavorites ? '관심종목' : '전체 종목';
  const matches = account.holdings.map((stock, index) => ({ stock, index })).filter(({stock, index}) =>
    (!onlyFavorites || favorites.includes(index)) && (stock.name + codes[index]).toLocaleLowerCase().replace(/\s+/g, '').includes(query));
  $('result-count').textContent = matches.length + '개 종목';
  $('stock-list').replaceChildren();
  for (const { stock, index } of matches) {
    const item = document.createElement('li'); item.className = 'card stock-item';
    const body = document.createElement('div'), title = document.createElement('h3'), code = document.createElement('span'), price = document.createElement('strong'), held = document.createElement('p');
    title.textContent = stock.name; code.textContent = codes[index] + ' · 연습 코드'; code.className = 'stock-code';
    price.textContent = stock.price.toLocaleString('ko-KR') + '원'; price.className = 'stock-price';
    held.textContent = '예시 주가 · 보유 ' + stock.quantity + '주'; body.append(title, code, price, held);
    const star = document.createElement('button'), selected = favorites.includes(index);
    star.type = 'button'; star.className = 'watch-button'; star.textContent = selected ? '★' : '☆';
    star.setAttribute('aria-pressed', String(selected)); star.setAttribute('aria-label', stock.name + ' 관심종목 ' + (selected ? '해제' : '추가'));
    star.disabled = !loaded || busy; star.addEventListener('click', () => save(index, !selected));
    const actions = document.createElement('div'), link = document.createElement('a'), info = document.createElement('span'); actions.className = 'stock-actions';
    link.href = 'trade.html?stock=' + index; link.className = 'trade-link'; link.textContent = '매수 연습'; link.setAttribute('aria-label', stock.name + ' 매수 연습');
    info.textContent = '수량과 비용은 다음 화면에서 확인'; actions.append(link, info); item.append(body, star, actions); $('stock-list').append(item);
  }
  $('stocks-empty').hidden = matches.length > 0;
  const noSaved = onlyFavorites && loaded && !favorites.length;
  $('empty-title').textContent = !loaded && onlyFavorites ? '관심종목을 불러오지 못했습니다' : noSaved ? '아직 관심종목이 없어요' : '검색 결과가 없어요';
  $('empty-description').textContent = !loaded && onlyFavorites ? '다시 불러오기를 눌러 저장된 기록을 확인해 주세요.' : noSaved ? '전체 종목에서 별표를 누르면 이곳에 모입니다.' : '이름이나 연습 코드를 확인하거나 검색어를 지워보세요.';
}
async function loadFavorites() {
  busy = true; render(); $('watchlist-status').textContent = '관심종목을 불러오는 중입니다.';
  try { favorites = await WatchlistStore.read(); loaded = true; $('retry-watchlist').hidden = true; $('watchlist-status').textContent = ''; }
  catch (e) { loaded = false; $('watchlist-status').textContent = e.message; $('retry-watchlist').hidden = false; }
  finally { busy = false; render(); }
}
async function save(index, selected) {
  if (busy || !loaded) return;
  busy = true; render(); $('watchlist-status').textContent = '관심종목을 저장하는 중입니다.';
  try { favorites = await WatchlistStore.set(index, selected); $('watchlist-status').textContent = account.holdings[index].name + (selected ? '을 관심종목에 저장했습니다.' : '을 관심종목에서 해제했습니다.'); }
  catch (e) { loaded = false; $('watchlist-status').textContent = e.message; $('retry-watchlist').hidden = false; }
  finally { busy = false; render(); }
}
$('search').addEventListener('input', render);
$('clear-search').addEventListener('click', () => { $('search').value = ''; render(); $('search').focus(); });
$('all-stocks').addEventListener('click', () => { onlyFavorites = false; render(); });
$('favorite-stocks').addEventListener('click', () => { onlyFavorites = true; render(); });
$('reset-filters').addEventListener('click', () => { onlyFavorites = false; $('search').value = ''; render(); $('search').focus(); });
$('retry-watchlist').addEventListener('click', () => { if (!busy) loadFavorites(); });
AppAccount.ready.then(async () => {
  account = DemoStore.read();
  $('watchlist-note').textContent = AppAccount.isCloud() ? '관심종목은 이메일 계정에 저장됩니다. 다른 기기에서도 이어서 볼 수 있어요.' : '로그인 없이 연습 중입니다. 관심종목은 이 브라우저에만 저장됩니다.';
  render(); await loadFavorites();
  DemoStore.subscribe(() => { account = DemoStore.read(); render(); });
  window.addEventListener('focus', () => { if (!busy) loadFavorites(); });
  window.addEventListener('storage', e => { if ((e.key === 'moui-tuja.watchlist.v1' || e.key === null) && !busy) loadFavorites(); });
}).catch(e => { $('result-count').textContent = ''; $('watchlist-status').textContent = e.message; });

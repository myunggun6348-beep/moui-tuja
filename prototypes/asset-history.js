// With fixed practice prices, total assets change only by fees and sell tax.
window.AssetHistory = (() => {
  const day = date => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  function build(account, period = 'all', now = new Date()) {
    const current = account.cash + account.holdings.reduce((sum, stock) => sum + stock.quantity * stock.price, 0);
    if (!Number.isFinite(current) || !Array.isArray(account.orders)) throw Error('자산 기록을 확인할 수 없습니다.');
    const orders = account.orders.map(order => {
      if (!Number.isFinite(order.fee) || !Number.isFinite(order.tax) || order.fee < 0 || order.tax < 0 || !Number.isFinite(Date.parse(order.at))) throw Error('자산 기록을 확인할 수 없습니다.');
      return { date: day(new Date(order.at)), cost: order.fee + order.tax };
    });
    const today = day(now), initial = current + orders.reduce((sum, order) => sum + order.cost, 0);
    if (!orders.length) return { points: [{ label: '현재', date: today, value: current }], change: 0, orders: 0 };
    let value = initial;
    const daily = new Map();
    for (const order of orders) { value -= order.cost; daily.set(order.date, value); }
    const dates = [...daily.keys()].sort();
    let start = initial, label = '첫 주문 전', selected = dates;
    if (period === '7' || period === '30') {
      const cutoff = new Date(today + 'T00:00:00Z'); cutoff.setUTCDate(cutoff.getUTCDate() - (Number(period) - 1));
      const from = cutoff.toISOString().slice(0, 10);
      for (const date of dates) if (date < from) start = daily.get(date);
      selected = dates.filter(date => date >= from && date <= today); label = '기간 시작';
    }
    const points = [{ label, date: null, value: start }, ...selected.map(date => ({ label: date.slice(5).replace('-', '/'), date, value: daily.get(date) }))];
    if (!points.some(point => point.date === today)) points.push({ label: '오늘', date: today, value: current });
    return { points, change: current - start, orders: orders.length };
  }
  return { build };
})();

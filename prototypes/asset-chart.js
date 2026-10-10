window.AssetChart = (() => {
  const byId = id => document.getElementById(id), won = n => Math.round(n).toLocaleString('ko-KR') + '원';
  let account, period = 'all', selected = -1, points = [];
  const svgNS = 'http://www.w3.org/2000/svg';
  function node(name, attrs, text) {
    const element = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function detail(index) {
    selected = index;
    const point = points[index];
    byId('chart-detail').textContent = (point.date || point.label) + ' · 총자산 ' + won(point.value);
    document.querySelectorAll('.chart-point').forEach((element, i) => { element.setAttribute('aria-pressed', String(i === index)); element.setAttribute('r', i === index ? '7' : '4'); });
    byId('chart-previous').disabled = index === 0;
    byId('chart-next').disabled = index === points.length - 1;
  }
  function draw() {
    if (!account) return;
    try {
      const history = AssetHistory.build(account, period);
      points = history.points;
      byId('chart-error').textContent = '';
      byId('chart-empty').hidden = history.orders > 0;
      byId('chart-content').hidden = history.orders === 0;
      byId('chart-first').textContent = won(points[0].value);
      byId('chart-latest').textContent = won(points.at(-1).value);
      byId('chart-change').textContent = (history.change > 0 ? '+' : history.change < 0 ? '−' : '') + won(Math.abs(history.change));
      const svg = byId('asset-chart'); svg.replaceChildren();
      const width = Math.max(300, Math.min(640, svg.clientWidth || 640)), left = 92, right = width - 24, top = 24, bottom = 192;
      svg.setAttribute('viewBox', '0 0 ' + width + ' 240');
      const values = points.map(point => point.value), min = Math.min(...values), max = Math.max(...values), padding = Math.max(100, (max - min) * .25), low = Math.max(0, min - padding), high = max + padding;
      const x = i => points.length === 1 ? (left + right) / 2 : left + i / (points.length - 1) * (right - left);
      const y = value => bottom - (value - low) / (high - low) * (bottom - top);
      for (let i = 0; i < 3; i++) {
        const value = high - (high - low) * i / 2, yy = y(value);
        svg.append(node('line', { x1: left, x2: right, y1: yy, y2: yy, stroke: '#dfe6f2' }), node('text', { x: left - 12, y: yy + 4, 'text-anchor': 'end', fill: '#66758b', 'font-size': 12 }, Math.round(value).toLocaleString('ko-KR')));
      }
      const coords = points.map((point, i) => x(i) + ',' + y(point.value));
      svg.append(node('polygon', { points: left + ',' + bottom + ' ' + coords.join(' ') + ' ' + x(points.length - 1) + ',' + bottom, fill: '#eaf0fc' }), node('polyline', { points: coords.join(' '), fill: 'none', stroke: '#2563eb', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
      // Every record is available through previous/next controls and the table.
      for (let i = 0; i < points.length; i++) {
        const point = points[i], dot = node('circle', { cx: x(i), cy: y(point.value), r: 4, fill: '#2563eb', class: 'chart-point', 'aria-hidden': 'true' });
        svg.append(dot);
      }
      for (const i of [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]) svg.append(node('text', { x: x(i), y: 222, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle', fill: '#66758b', 'font-size': 12 }, points[i].label));
      const table = byId('chart-records'); table.replaceChildren();
      for (const point of points.slice().reverse()) {
        const tr = document.createElement('tr'), date = document.createElement('th'), value = document.createElement('td');
        date.scope = 'row'; date.textContent = point.date || point.label; value.textContent = won(point.value); tr.append(date, value); table.append(tr);
      }
      detail(points.length - 1);
    } catch (e) { byId('chart-error').textContent = e.message; byId('chart-content').hidden = true; byId('chart-empty').hidden = true; }
  }
  function render(value, hidden) { account = value; draw(); privacy(hidden); }
  function privacy(hidden) { byId('asset-history-body').hidden = hidden; byId('chart-private').hidden = !hidden; }
  document.querySelectorAll('[data-chart-period]').forEach(button => button.addEventListener('click', () => {
    period = button.dataset.chartPeriod;
    document.querySelectorAll('[data-chart-period]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    draw();
  }));
  byId('chart-previous').addEventListener('click', () => detail(Math.max(0, selected - 1)));
  byId('chart-next').addEventListener('click', () => detail(Math.min(points.length - 1, selected + 1)));
  window.addEventListener('resize', draw);
  return { render, privacy };
})();

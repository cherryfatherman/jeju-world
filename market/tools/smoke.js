const { chromium, devices } = require('playwright');
const pages = ['/', '/market.html?type=project', '/market.html?type=home', '/board.html?kind=program', '/board.html?kind=insight', '/post.html?kind=program&id=jccei-w-join', '/post.html?kind=insight&id=startup-survey-2023', '/hackathon.html', '/winners.html', '/jeju.html', '/guide.html?id=recycle-center', '/places.html?type=spot', '/place.html?id=seongsan', '/project.html?id=s01', '/project.html?id=h01', '/search.html?q=제주', '/sell.html', '/admin.html', '/map.html', '/map.html?show=deal', '/hq.html'];;
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  for (const u of pages) {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    p.on('response', (r) => { if (r.url().includes('localhost') && r.status() >= 400 && !r.url().includes('/api/admin')) errs.push(`${r.status()} ${r.url()}`); });
    await p.goto('http://localhost:4000' + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    console.log(errs.length ? 'FAIL' : 'ok  ', u, errs.join(' | '));
    await p.close();
  }
  await b.close();
})();

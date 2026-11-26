const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync('public/icon.svg', 'utf8');
  const b = await chromium.launch();
  for (const [name, size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:#0c0c0e">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: 'public/' + name, omitBackground: false });
  }
  await b.close();
})();

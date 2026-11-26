const fs = require('fs');
const html = fs.readFileSync('dist-single/index.html', 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...html.matchAll(/<script type="module"[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
const out = `<title>Stimulus Coach</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#09090b">
${styles}
<style>html,body{background:#09090b}</style>
<div id="root"></div>
${scripts}
`;
fs.writeFileSync(process.argv[2], out);
console.log('bytes', out.length, 'styles', styles.length, 'scripts', scripts.length);

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'css', 'tailwind.min.css');
const css = fs.readFileSync(file, 'utf8').replaceAll('url(assets/', 'url(../assets/');
fs.writeFileSync(file, css);

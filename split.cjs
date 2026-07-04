const fs = require('fs');
const html = fs.readFileSync('computation.html', 'utf8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
// Use a more specific regex for the JS script block to avoid matching html2pdf CDN script
const scriptRegex = /<script>\s*function getRebarArea([\s\S]*?)<\/script>/;

const styleMatch = html.match(styleRegex);
if (styleMatch) {
  fs.writeFileSync('lrfdstyle.css', styleMatch[1].trim());
  console.log('Wrote lrfdstyle.css');
}

const scriptMatch = html.match(scriptRegex);
if (scriptMatch) {
  // We need to put `function getRebarArea` back since it was part of our regex match
  fs.writeFileSync('lrfdscript.js', ('function getRebarArea' + scriptMatch[1]).trim());
  console.log('Wrote lrfdscript.js');
}

let newHtml = html.replace(styleRegex, '<link rel="stylesheet" href="lrfdstyle.css">');
newHtml = newHtml.replace(scriptRegex, '<script src="lrfdscript.js"></script>');
fs.writeFileSync('computation.html', newHtml);
console.log('Updated computation.html');

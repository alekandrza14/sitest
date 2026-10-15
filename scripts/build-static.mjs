// Подготовка статической версии для Render. Зависимостей npm нет.
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const publicFiles = [
  'index.html', 'styles.css', 'config.js', 'app.js',
  'developer-core.js', 'developer.js', 'favicon.svg'
];

// Сначала проверяем все источники. Скрипты разбираем, но не исполняем.
const entries = await Promise.all(publicFiles.map(async name => {
  const contents = await readFile(path.join(root, name));
  if (name.endsWith('.js')) new vm.Script(contents.toString('utf8'), { filename: name });
  return { name, contents };
}));
const html = entries.find(entry => entry.name === 'index.html').contents.toString('utf8');
for (const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)) {
  if (!publicFiles.includes(match[1])) throw new Error(`Ресурс не включён в публикацию: ${match[1]}`);
}
if (!html.includes('https://yoomoney.ru/quickpay/confirm')) throw new Error('Не найден адрес формы ЮMoney.');

// dist — только результат сборки. Мастер настройки и README не публикуются.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of entries) await writeFile(path.join(output, entry.name), entry.contents);
console.log(`Render: подготовлено ${entries.length} файлов в dist.`);

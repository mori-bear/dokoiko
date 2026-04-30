/**
 * rewriteDescriptions.js — 全目的地の説明文を感情に刺さる文章にリライト
 * Claude API (claude-sonnet-4-6) 使用
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const client = new Anthropic();

const SYSTEM_PROMPT = `あなたは旅行コピーライターです。目的地の説明文を、読んだ瞬間に「行きたい」と思わせる40〜60文字の日本語にリライトしてください。

ルール:
- 五感を刺激する情景描写を入れる
- 体験・感情を主体に（何があるかより、どんな気持ちになるか）
- 旅情・非日常感を前面に
- 体言止めや余韻を使う
- 観光パンフレット的な表現（〜がある・〜できる）は避ける
- リライト後の説明文のみを返す（説明・引用符・前置き不要）`;

async function rewrite(dest) {
  const tags = (dest.tags ?? []).slice(0, 3).join('・');
  const userMsg = `目的地情報: name=${dest.displayName || dest.name}, region=${dest.prefecture ?? dest.region}, tags=${tags}
現在の説明文: ${dest.description ?? '（なし）'}`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 120,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  });
  return msg.content[0]?.text?.trim() ?? dest.description;
}

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = data.filter(d => d.type === 'destination');

console.log(`リライト対象: ${targets.length}件\n`);

let done = 0;
const samples = [];

for (const dest of data) {
  if (dest.type !== 'destination') continue;
  try {
    const newDesc = await rewrite(dest);
    dest.description = newDesc;
    done++;
    if (done <= 5) samples.push({ name: dest.name, desc: newDesc });
    if (done % 50 === 0) {
      process.stdout.write(`  ${done}/${targets.length}件完了...\n`);
      fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn(`⚠️ ${dest.name}: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 500));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');

console.log(`\n=== 完了: ${done}件リライト ===\n`);
console.log('【サンプル5件】');
samples.forEach(s => console.log(` ${s.name}: ${s.desc}`));

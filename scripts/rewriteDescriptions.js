import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();
const destFile = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destFile, 'utf8'));

async function rewrite(dest) {
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `
以下の旅行先の「description」と「catch」を
感情に刺さる日本語にリライトしてください。

目的地: ${dest.name}
都道府県: ${dest.prefecture}
現在のdescription: ${dest.description}
現在のcatch: ${dest.catch}
タグ: ${dest.tags?.join('、')}
スポット: ${dest.spots?.join('、')}

【ルール】
- description: 50〜80文字。五感を刺激する情景描写。「何があるか」より「どんな気持ちになるか」
- catch: 30〜50文字。体言止め・余韻・旅情。読んだ瞬間に行きたくなる一文。
- 観光パンフレット的な表現は避ける
- JSONのみ出力（説明不要）

出力形式:
{"description": "...", "catch": "..."}
      `
    }]
  });

  const text = res.content[0].text.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function main() {
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < data.length; i++) {
    const dest = data[i];
    try {
      const result = await rewrite(dest);
      data[i].description = result.description;
      data[i].catch = result.catch;
      updated++;
      console.log(`✅ ${dest.name}: ${result.catch}`);
    } catch (e) {
      errors++;
      console.error(`❌ ${dest.name}: ${e.message}`);
    }

    // 50件ごとに中間保存
    if (updated % 50 === 0) {
      fs.writeFileSync(destFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`💾 ${updated}件保存済み`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(destFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n🎉 完了: ${updated}件更新 / ${errors}件エラー`);
}

main().catch(console.error);

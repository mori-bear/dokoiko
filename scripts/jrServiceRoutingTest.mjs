// JR予約サービス振り分け 5パターン確認テスト
// 期待: えきねっと / e5489 / スマートEX / JR九州ネット予約 / みどりの窓口
import { pickJRService, jrServiceUrl, jrServiceLabel } from '/Users/moririn/MORI-LAB/projects/dokoiko-site/scripts/jrServiceMap.js';

const cases = [
  { orig: '東京都', dest: '宮城県',   expect: 'ekinet',     label: 'えきねっと' },
  { orig: '大阪府', dest: '京都府',   expect: 'e5489',      label: 'e5489' },
  { orig: '東京都', dest: '京都府',   expect: 'smartex',    label: 'スマートEX' },
  { orig: '福岡県', dest: '熊本県',   expect: 'jrkyushu',   label: 'JR九州ネット予約' },
  { orig: '北海道', dest: '福岡県',   expect: 'midori',     label: 'みどりの窓口' },
];

let fail = 0;
for (const c of cases) {
  const svc = pickJRService(c.orig, c.dest);
  const url = jrServiceUrl(svc);
  const label = jrServiceLabel(svc);
  const ok = (svc === c.expect && label === c.label);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'NG '} ${c.orig} → ${c.dest}: svc=${svc} (expect=${c.expect}) label="${label}" url=${url}`);
}
console.log(`\nResult: ${cases.length - fail}/${cases.length} PASS`);
process.exit(fail ? 1 : 0);

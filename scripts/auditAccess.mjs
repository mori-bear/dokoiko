// destinationsのaccess構造を検査し、明らかな異常をlist + 自動修正
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

// 本州扱いの prefecture (北海道/沖縄/離島系九州・四国・本州中の島は含めない)
const HONSHU_PREFS = new Set([
  '青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
]);

function isIslandDest(d){
  return d.destType === 'island' || d.subType === 'island' || !!d.isIsland;
}

const issues = [];
let fixedCount = 0;

for (const d of dests) {
  const steps = (d.access?.steps) || [];
  const types = new Set(steps.map(s => s.type));
  const island = isIslandDest(d);
  const honshu = HONSHU_PREFS.has(d.prefecture);
  const gateways = d.gateways || {};
  const hasAirport = (gateways.airport || []).length > 0;
  const hasFerry = (gateways.ferry || []).length > 0;
  const hasRailGateway = (gateways.rail || []).length > 0;

  // 1) 離島なのに flight/ferry 系のアクセス手段が無い (steps が rail のみ or 空) かつ gateways にも airport/ferry が無い
  const islandButNoAirferry =
    island
    && !types.has('flight') && !types.has('ferry')
    && !hasAirport && !hasFerry;

  // 2) 本州なのに flight が steps[0] (空路前提) — 但し例外は離島あり (Honshu の伊豆諸島など)
  const honshuButFlight =
    honshu && !island
    && steps[0]?.type === 'flight';

  // 3) gateways.airport も ferry も rail も全部空 (移動手段不明) かつ access.steps が空
  const noGateway = !hasAirport && !hasFerry && !hasRailGateway && steps.length === 0;

  if (islandButNoAirferry || honshuButFlight || noGateway) {
    issues.push({
      id: d.id, name: d.name, prefecture: d.prefecture,
      destType: d.destType, subType: d.subType,
      flags: { islandButNoAirferry, honshuButFlight, noGateway },
      stepTypes: [...types],
      gateways,
    });

    // 修正
    if (islandButNoAirferry) {
      // 飛行機 or 船で到達する想定。県別に決め打ち
      const pref = d.prefecture || '';
      // 沖縄離島: 那覇空港経由 (default to ferry from 那覇港 if 直行空港なし、ここでは flight to nearest airport)
      const guess = islandAccessGuess(d);
      if (guess) {
        d.access = d.access || {};
        d.access.steps = guess.steps;
        d.gateways = d.gateways || {};
        if (guess.airport && !(d.gateways.airport||[]).length) d.gateways.airport = [guess.airport];
        if (guess.ferry && !(d.gateways.ferry||[]).length) d.gateways.ferry = [guess.ferry];
        d._accessAutoFixed = 'islandFix';
        fixedCount++;
      }
    } else if (honshuButFlight) {
      // 本州で先頭 flight は不自然 → steps から flight を除去 (鉄道のみで到達できる前提)
      d.access.steps = steps.filter(s => s.type !== 'flight');
      d.gateways = d.gateways || {};
      d.gateways.airport = []; // クリア
      d._accessAutoFixed = 'honshuFlightRemoved';
      fixedCount++;
    }
  }
}

// 離島の推測
function islandAccessGuess(d){
  const pref = d.prefecture || '';
  const name = d.name || '';
  // 沖縄県の主要離島対応
  const okinawaMap = {
    '久米島':[{type:'flight', to:'久米島空港'}], '宮古島':[{type:'flight', to:'宮古空港'}],
    '石垣島':[{type:'flight', to:'石垣空港'}], '西表島':[{type:'flight', to:'石垣空港'}, {type:'ferry', to:'西表島'}],
    '与那国島':[{type:'flight', to:'与那国空港'}],
  };
  if (okinawaMap[name]) return { steps: okinawaMap[name], airport: okinawaMap[name][0].to };
  if (pref === '沖縄県' || pref.startsWith('沖縄')) {
    return { steps: [{type:'flight', to:'那覇空港'}, {type:'ferry', to: name}], airport:'那覇空港', ferry:'那覇港' };
  }
  // 鹿児島離島
  if (pref === '鹿児島県') {
    return { steps: [{type:'flight', to:'鹿児島空港'}, {type:'ferry', to: name}], airport:'鹿児島空港', ferry:'鹿児島港' };
  }
  // 長崎離島
  if (pref === '長崎県') {
    return { steps: [{type:'flight', to:'長崎空港'}, {type:'ferry', to: name}], airport:'長崎空港', ferry:'長崎港' };
  }
  // 北海道離島(利尻・礼文・奥尻など)
  if (pref === '北海道') {
    return { steps: [{type:'flight', to:'稚内空港'}, {type:'ferry', to: name}], airport:'稚内空港', ferry:'稚内港' };
  }
  // 東京の島嶼(伊豆諸島・小笠原)
  if (pref === '東京都') {
    return { steps: [{type:'flight', to:'調布飛行場'}, {type:'ferry', to: name}], ferry: '東京港' };
  }
  // それ以外の離島はフェリーのみ
  return { steps: [{type:'ferry', to: name}], ferry: name };
}

fs.writeFileSync(path.join(ROOT, 'logs/accessAudit.json'), JSON.stringify({ total: dests.length, issuesFound: issues.length, autoFixed: fixedCount, issues }, null, 2));
console.log(`access audit: total=${dests.length} issuesFound=${issues.length} autoFixed=${fixedCount}`);

// 内訳
const flagCount = { islandButNoAirferry:0, honshuButFlight:0, noGateway:0 };
for (const issue of issues) {
  for (const k of Object.keys(flagCount)) if (issue.flags[k]) flagCount[k]++;
}
console.log('flags:', flagCount);

// destinations を上書き保存 (修正が入ったもののみ)
if (fixedCount > 0) {
  fs.writeFileSync(SRC, JSON.stringify(dests, null, 2));
  console.log('saved', SRC);
}

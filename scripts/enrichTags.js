/**
 * enrichTags.js — グルメ・春・夏・秋 タグ補完
 *
 * 判定方法:
 *   1. キーワードスキャン（description / spots / catch / name）
 *   2. 手動キュレーションリスト（キーワードが薄い著名目的地を補完）
 *
 * 追加先: primary/secondary 有りの場合は secondary へ、なければ tags へ
 * 既存タグは上書きせず追加のみ
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// ── テーマエイリアス（selectionEngine と同一） ─────────────────────────────
const ALIASES = {
  'グルメ': ['グルメ', '海の幸', '食文化', '食'],
  '春':     ['春', '桜', '花見', '梅'],
  '夏':     ['夏', '海水浴', 'サーフィン', '海開き', 'ひまわり'],
  '秋':     ['秋', '紅葉', 'もみじ', 'コスモス'],
};

// ── キーワード → テーマ ───────────────────────────────────────────────────
const KEYWORD_MAP = {
  'グルメ': /ラーメン|蕎麦|そば|うどん|海鮮|郷土料理|屋台|食文化|料理|魚市場|漁港|市場|酒蔵|醸造|味噌|醤油|発酵|食堂|漁師|朝市|牛肉|焼肉|シーフード|ふぐ|フグ|精進料理|ウニ|さんま|ぶり|かに|鮮魚|水産|青空市/,
  '春':     /桜|さくら|花見|梅|チューリップ|菜の花|春まつり|ソメイヨシノ|花の名所/,
  '夏':     /ひまわり|ラベンダー|海水浴|花火|夏祭り|夏の|避暑|高原リゾート|ラベンダー畑|ひまわり畑/,
  '秋':     /紅葉|もみじ|コスモス|秋まつり|秋の|栗きんとん|錦秋|落葉|紅|秋景/,
};

// ── 手動キュレーション（キーワードで拾えない著名目的地） ──────────────────
// { id: ['追加するタグ', ...] }
const MANUAL_ADDITIONS = {
  // ── グルメ ──────────────────────────────────────────────────────────────
  'shodoshima':       ['グルメ'],  // 醤油・オリーブの産地
  'takayama-o':       ['グルメ'],  // 飛騨高山：朝市・みたらし団子・飛騨牛
  'shimonoseki':      ['グルメ'],  // ふぐ料理
  'wajima':           ['グルメ'],  // 朝市・海産物
  'sakata':           ['グルメ'],  // 北前船の食文化
  'himi':             ['グルメ'],  // 寒ぶり
  'ouchi-juku':       ['グルメ'],  // ネギそば
  'koyasan':          ['グルメ'],  // 精進料理
  'izushi':           ['グルメ'],  // 出石皿そば
  'shakotan':         ['グルメ'],  // ウニ料理
  'izumo':            ['グルメ'],  // 出雲そば
  'mojiko':           ['グルメ'],  // 焼きカレー
  'tsuruga':          ['グルメ'],  // 鮮魚市場
  'choshi':           ['グルメ'],  // 醤油・海産物
  'ito':              ['グルメ'],  // 海鮮
  'ofunato':          ['グルメ'],  // 三陸さんま
  'rausu':            ['グルメ'],  // 知床の海の幸
  'togakushi':        ['グルメ'],  // 戸隠そば
  'ishinomaki':       ['グルメ'],  // 三陸海産物
  'nanao':            ['グルメ'],  // 七尾の海産物
  'sukumo':           ['グルメ'],  // 海鮮
  'ono-fukui':        ['グルメ'],  // 越前そば
  'hijori-onsen':     ['グルメ'],  // 朝市のある温泉地
  'saiki':            ['グルメ'],  // 魚市場
  'yawatahama':       ['グルメ'],  // じゃこ天・魚市場
  'kashima-saga':     ['グルメ'],  // 酒蔵・鹿島の食文化
  'aji-peninsula':    ['グルメ'],  // 漁師町
  'shishikui':        ['グルメ'],  // 漁師町・海産物
  'mihonoseki':       ['グルメ'],  // 漁師町・のどくろ
  'oarai':            ['グルメ'],  // 海鮮・あんこう鍋
  'nakatsugawa':      ['グルメ'],  // 栗きんとんの本場（秋も）
  'miyoshi-hiroshima':['グルメ'],  // 酒蔵

  // ── 春 ──────────────────────────────────────────────────────────────────
  'hirosaki':         ['春'],      // 弘前公園：日本一の桜
  'ibaraki-mito':     ['春'],      // 偕楽園：梅の名所
  'dazaifu':          ['春'],      // 太宰府天満宮：梅
  'higashine':        ['春'],      // 東根の桜並木
  'tendo':            ['春'],      // 寒河江市：花の名所
  'tonami':           ['春'],      // 砺波のチューリップ
  'ogata':            ['春'],      // 大潟村：菜の花・コスモス
  'misumi-shimane':   ['春'],      // 桜
  'yuwaku-onsen':     ['春'],      // 梅林
  'okazaki':          ['春'],      // 岡崎城の桜
  'asakura':          ['春'],      // 朝倉の桜並木
  'miyakonojo':       ['春'],      // 梅
  'aizu':             ['春'],      // 鶴ヶ城の桜
  'hofu':             ['春'],      // 防府天満宮の梅

  // ── 夏 ──────────────────────────────────────────────────────────────────
  'karuizawa':        ['夏'],      // 避暑地の代名詞
  'furano':           ['夏'],      // ラベンダー畑
  'hakuba':           ['夏'],      // 高原リゾート
  'kamikochi':        ['夏'],      // 高原の夏
  'nasu':             ['夏'],      // 那須高原
  'kiyosato':         ['夏'],      // 清里高原
  'hachimantai':      ['夏'],      // 八幡平高原
  'myoko-kogen':      ['夏'],      // 妙高高原
  'tateshina':        ['夏'],      // 蓼科高原
  'nagaoka':          ['夏'],      // 長岡花火大会
  'tondabayashi':     ['夏'],      // PLの花火
  'minami-aso':       ['夏'],      // 南阿蘇高原
  'ebino-kogen':      ['夏'],      // えびの高原
  'ebino':            ['夏'],      // 高原
  'shikoku-karst':    ['夏'],      // 四国カルスト高原
  'unzen':            ['夏'],      // 高原・雲仙
  'izu-kogen':        ['夏'],      // 伊豆高原
  'minakami-onsen':   ['夏'],      // 夏のアウトドア
  'akakura-onsen':    ['夏'],      // 高原温泉
  'fujikawaguchiko':  ['夏'],      // 富士山麓高原
  'kusatsu-onsen':    ['夏'],      // 草津高原
  'izu-oshima':       ['夏'],      // 夏の島
  'mojiko':           ['夏'],      // 花火（既にグルメ追加）
  'kitakami':         ['夏'],      // 北上花火
  'ofunato':          ['夏'],      // 三陸花火

  // ── 秋 ──────────────────────────────────────────────────────────────────
  'obuse':            ['秋'],      // 栗の里
  'tanba-sasayama':   ['秋'],      // 丹波篠山：栗・黒豆の秋
  'kasama':           ['秋'],      // 笠間の栗
  'nakatsugawa':      ['秋'],      // 栗きんとん（グルメと重複可）
  'miyoshi-hiroshima':['秋'],      // 三次のワイン・秋景
  'katsunuma':        ['秋'],      // 勝沼のぶどう狩り
  'shionoe':          ['秋'],      // 塩江の紅葉
  'ogata':            ['秋'],      // 大潟村：コスモス（春と重複可）
};

// ── 集計用 ──────────────────────────────────────────────────────────────────
const countBefore = {};
const countAfter  = {};
for (const theme of Object.keys(ALIASES)) {
  countBefore[theme] = 0;
  countAfter[theme]  = 0;
}

// ── タグ有無チェック ─────────────────────────────────────────────────────────
function hasTheme(dest, theme) {
  const p = dest.primary   ?? [];
  const s = dest.secondary ?? [];
  const t = (p.length === 0 && s.length === 0) ? (dest.tags ?? []) : [];
  return [...p, ...s, ...t].some(tag => ALIASES[theme].includes(tag));
}

// ── 事前集計（Before） ───────────────────────────────────────────────────────
for (const dest of data) {
  if (dest.type !== 'destination') continue;
  for (const theme of Object.keys(ALIASES)) {
    if (hasTheme(dest, theme)) countBefore[theme]++;
  }
}

// ── タグ追加 ────────────────────────────────────────────────────────────────
let totalAdded = 0;
const changeLog = [];

function addTag(dest, tag) {
  const hasPrimary = (dest.primary?.length ?? 0) > 0 || (dest.secondary?.length ?? 0) > 0;
  if (hasPrimary) {
    if (!dest.secondary) dest.secondary = [];
    if (!dest.secondary.includes(tag)) {
      dest.secondary.push(tag);
      return true;
    }
  } else {
    if (!dest.tags) dest.tags = [];
    if (!dest.tags.includes(tag)) {
      dest.tags.push(tag);
      return true;
    }
  }
  return false;
}

for (const dest of data) {
  if (dest.type !== 'destination') continue;

  const addedTags = [];

  // ── キーワードスキャン ──────────────────────────────────────────────────
  const scanText = [
    dest.name, dest.description, dest.catch,
    ...(dest.spots ?? []),
  ].join(' ');

  for (const [theme, kw] of Object.entries(KEYWORD_MAP)) {
    if (!hasTheme(dest, theme) && kw.test(scanText)) {
      // テーマに対応するタグ名（primary タグとして使う）
      const tagName = theme;
      if (addTag(dest, tagName)) {
        addedTags.push(tagName);
        totalAdded++;
      }
    }
  }

  // ── 手動キュレーション ──────────────────────────────────────────────────
  const manual = MANUAL_ADDITIONS[dest.id];
  if (manual) {
    for (const tag of manual) {
      if (!hasTheme(dest, tag) && addTag(dest, tag)) {
        addedTags.push(tag);
        totalAdded++;
      }
    }
  }

  if (addedTags.length > 0) {
    changeLog.push({ id: dest.id, name: dest.name, added: addedTags });
  }
}

// ── 事後集計（After） ────────────────────────────────────────────────────────
for (const dest of data) {
  if (dest.type !== 'destination') continue;
  for (const theme of Object.keys(ALIASES)) {
    if (hasTheme(dest, theme)) countAfter[theme]++;
  }
}

// ── 保存 ────────────────────────────────────────────────────────────────────
fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');

// ── レポート ─────────────────────────────────────────────────────────────────
console.log('\n=== enrichTags.js 実行結果 ===\n');
console.log('変更ログ:');
for (const c of changeLog) {
  console.log(`  ✅ ${c.id} (${c.name}): +[${c.added.join(', ')}]`);
}

console.log('\nテーマ別カバレッジ変化:');
for (const theme of Object.keys(ALIASES)) {
  const diff = countAfter[theme] - countBefore[theme];
  const bar = diff > 0 ? ` +${diff}件 ↑` : '';
  console.log(`  ${theme.padEnd(6)}: ${countBefore[theme]}件 → ${countAfter[theme]}件${bar}`);
}

console.log(`\n合計タグ追加: ${totalAdded}件`);
console.log(`変更目的地数: ${changeLog.length}件`);

/**
 * routeResolver.js — 3層アーキテクチャ ルート解決エンジン
 *
 * ① Gateway Database（destinations.json の gatewayStations / localAccess）
 * ② Transport Graph（transportGraph.json 上のダイクストラ探索）
 * ③ Route Resolver（このファイル）
 *
 * 解決フロー:
 *   1. Gateway DB（gatewayStations 設定済みの場合 — 幹線BFS + ローカルDB + finalPoint）
 *   2. Transport Graph フルパス BFS（gateway未設定の場合）
 *   3. null → 呼び出し側でパターンビルダーへ降格
 *
 * 返却値:
 *   { steps: Array, method: 'graph'|'gateway-db'|null }
 *
 *   steps 各要素（BFS 形式）:
 *     { type, from, to, label, provider, operator, minutes }
 */

import { buildRoute, buildTrunkRoute } from './bfsEngine.js';
import { DEPARTURE_CITY_INFO, DEPARTURE_COORDS } from '../config/constants.js';
import { loadJson }                       from '../lib/loadJson.js';
import { scoreRoute }                     from '../transport/routeNarrator.js';
import { calcDistanceKm }                 from '../utils/geo.js';

/* ── gateways.json: destId → 経由地チェーン ── */
const GATEWAYS_MAP = await loadJson('../data/gateways.json', import.meta.url).catch(() => ({}));

/* ── invalidRoutes.json: 廃線・無効交通手段ブラックリスト ── */
const INVALID_ROUTES = await loadJson('../data/invalidRoutes.json', import.meta.url).catch(() => ({}));

/* ── 飛行機使用の最低直線距離（km） ── */
const FLIGHT_MIN_DISTANCE_KM = 300;

/* ─── 新幹線停車駅（フォールバック時の型判定） ─── */
const SHINKANSEN_STATIONS = new Set([
  '東京駅','品川駅','新横浜駅','小田原駅','熱海駅','三島駅','新富士駅',
  '静岡駅','掛川駅','浜松駅','豊橋駅','三河安城駅','名古屋駅','岐阜羽島駅',
  '米原駅','京都駅','新大阪駅','新神戸駅','西明石駅','姫路駅','相生駅',
  '岡山駅','新倉敷駅','福山駅','新尾道駅','三原駅','東広島駅','広島駅',
  '新岩国駅','徳山駅','新山口駅','厚狭駅','新下関駅','小倉駅','博多駅',
  '上野駅','大宮駅','小山駅','宇都宮駅','那須塩原駅','新白河駅',
  '郡山駅','福島駅','白石蔵王駅','仙台駅','古川駅','くりこま高原駅',
  '一ノ関駅','水沢江刺駅','北上駅','新花巻駅','盛岡駅','二戸駅',
  '八戸駅','七戸十和田駅','新青森駅',
  '大曲駅','秋田駅','山形駅','天童駅','さくらんぼ東根駅','村山駅','大石田駅','新庄駅',
  '長野駅','飯山駅','上越妙高駅','糸魚川駅','黒部宇奈月温泉駅',
  '富山駅','新高岡駅','金沢駅','小松駅','加賀温泉駅','芦原温泉駅',
  '福井駅','越前たけふ駅','敦賀駅',
  '新鳥栖駅','久留米駅','筑後船小屋駅','新大牟田駅','新玉名駅',
  '熊本駅','新八代駅','新水俣駅','出水駅','川内駅','鹿児島中央駅',
  '長崎駅','諫早駅','嬉野温泉駅','武雄温泉駅',
  '新函館北斗駅',
]);

/* ─── ローカルアクセス路線名マップ ───
 * destinations.json の localAccess.description が汎用的すぎる場合に上書き。
 * 実際の路線名・交通手段名を表示するための手動設定。
 */
const LOCAL_LINE_MAP = {
  /* 越美北線 */
  'ono-fukui':       '越美北線',
  /* えちぜん鉄道 */
  'katsuyama':       'えちぜん鉄道',
  /* 高山本線 */
  'gero-onsen':      '高山本線（特急ひだ）',
  'hida-furukawa':   '高山本線',
  'takayama-kogen':  '高山本線',
  /* 山形鉄道フラワー長井線 */
  'nagai':           '山形鉄道フラワー長井線',
  /* 三陸鉄道 */
  'ryoishi':         '三陸鉄道南リアス線',
  /* 紀勢本線 */
  'owase':           '特急南紀',
  /* 伊豆急行 */
  'shimoda':         '伊豆急行',
  /* 土讃線 */
  'oboke':           '土讃線',
  /* 吉野川特急 */
  'iya':             '土讃線',
  /* 予土線 */
  'shimanto-river':  '予土線',
  /* 日田彦山線BRT */
  'hita':            '日田彦山線BRT',
  /* 指宿枕崎線 */
  'ibusuki':         '指宿枕崎線',
  /* バスアクセス */
  'nikko':           '日光線・東武日光線',
  'hakusan-spa':     '路線バス',
  'myoko-kogen':     'えちごトキめき鉄道',
  /* レンタカー */
  'karuizawa':       'しなの鉄道',
};

/* ────────────────────────────────────────
   公開 API
──────────────────────────────────────── */

/**
 * ルート解決エントリーポイント。
 *
 * @param {string} departure  — 出発都市名（例: '東京'）
 * @param {object} destination — destinations.json エントリ
 * @returns {{ steps: Array, method: string } | null}
 *          steps は BFS step 形式の配列。解決不能な場合は null。
 */
export function resolveRoute(departure, destination) {
  const candidates = [];

  /* ── Layer ①: Gateway DB（gatewayStations 設定済み → 幹線BFS + ローカルDB） ── */
  if (destination.gatewayStations?.length > 0) {
    const gwResult = _tryGatewayDb(departure, destination);
    if (gwResult) candidates.push(gwResult);
  }

  /* ── Layer ①': gateways.json 経由チェーン（BFSより優先: 見つかれば即リターン） ── */
  const vias = GATEWAYS_MAP[destination.id];
  if (vias?.length > 0 && candidates.length === 0) {
    const chainResult = _tryGatewayChain(departure, destination, vias);
    if (chainResult) return chainResult;  // spec: BFSより優先
  }

  /* ── Layer ②: Transport Graph フルパス BFS ── */
  const bfsResult = _tryBfs(departure, destination);
  if (bfsResult) candidates.push(bfsResult);

  if (candidates.length === 0) return null;

  /* 複数候補があれば最高スコアを採用 */
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, c) =>
    scoreRoute(c.steps) >= scoreRoute(best.steps) ? c : best
  );
}

/**
 * situations フィルタ用ヘルパー。
 * destination.situations が userType を含まない場合は false。
 */
export function matchesSituation(destination, userType) {
  if (!userType) return true; // フィルタなし
  const sits = destination.situations;
  if (!sits?.length) return true; // 未設定は全対象
  return sits.includes(userType);
}

/* ────────────────────────────────────────
   Layer ②: BFS（Transport Graph）
──────────────────────────────────────── */

function _tryBfs(departure, destination) {
  const steps = buildRoute(departure, destination);
  if (!steps || steps.length < 1) return null;

  /* mountain / remote / requiresCar は飛行機ルートを不採用 */
  const isMountainRemote = destination.destType === 'mountain'
    || destination.destType === 'remote'
    || destination.requiresCar;
  if (isMountainRemote && steps.some(s => s.type === 'flight')) {
    return null;
  }

  /* 直行便なし（hasDirectFlight !== true）のに flight ステップが含まれる → 不採用 */
  if (!destination.hasDirectFlight && steps.some(s => s.type === 'flight')) {
    return null;
  }

  /* 直線距離 300km 未満は飛行機不採用 */
  if (steps.some(s => s.type === 'flight')) {
    const depCoords  = DEPARTURE_COORDS[departure];
    const destCoords = (destination.lat && destination.lng)
      ? { lat: destination.lat, lng: destination.lng }
      : null;
    if (depCoords && destCoords) {
      const distKm = calcDistanceKm(depCoords, destCoords);
      if (distKm < FLIGHT_MIN_DISTANCE_KM) return null;
    }
  }

  /* invalidRoutes: 廃線・無効交通手段のフィルタ */
  const blocked = INVALID_ROUTES[destination.id];
  if (blocked?.length && steps.some(s => blocked.includes(s.type))) {
    return null;
  }

  /* finalPoint 注入: BFS は accessStation までしか到達しないため、
     finalPoint が設定されている場合はラストマイルステップを追加する */
  const finalPt = destination.finalPoint
    ?? (Array.isArray(destination.spots) && destination.spots[0]);
  if (finalPt) {
    const lastTo     = steps[steps.length - 1]?.to;
    const accessSt   = destination.accessStation;
    /* lastStep が accessStation に到達していてかつ finalPoint と異なる場合に追加 */
    if (lastTo && finalPt !== lastTo) {
      const lastAccessStep = destination.access?.steps?.find(s => s.type === 'local');
      let method = lastAccessStep?.method ?? '徒歩';
      /* 徒歩60分超（≈5km超）は現実的でないため bus に格上げ */
      if (method === '徒歩' && destination.walkMinutes && destination.walkMinutes > 60) {
        method = 'バス';
      }
      const type   = method === 'レンタカー' ? 'localMove'
                   : method === 'バス'       ? 'bus'
                   : method === 'フェリー'    ? 'ferry'
                   : 'localMove';
      const label  = destination.walkMinutes ? `徒歩${destination.walkMinutes}分` : method;
      steps.push({
        type,
        from:     lastTo,
        to:       finalPt,
        label,
        provider: null,
        operator: null,
        minutes:  destination.walkMinutes ?? null,
      });
    }
  }

  return { steps, method: 'graph' };
}

/* ────────────────────────────────────────
   Layer ①': gateways.json 経由チェーン
   vias 配列の都市を順に経由する人間的ルートを構築。
   BFS で各セグメントを展開し連結する。
──────────────────────────────────────── */

function _tryGatewayChain(departure, destination, vias) {
  const fromCity  = DEPARTURE_CITY_INFO[departure];
  const origin    = fromCity?.rail ?? `${departure}駅`;

  const steps = [];
  const cities = [departure, ...vias, destination.name];

  /* セグメントごとに BFS で幹線ステップを展開 */
  for (let i = 0; i < cities.length - 1; i++) {
    const segDep  = cities[i];
    const segDest = cities[i + 1];
    const trunkSteps = buildTrunkRoute(segDep, segDest + '駅');
    if (trunkSteps.length > 0) {
      steps.push(..._collapseConsecutiveShinkansen(trunkSteps));
    } else {
      /* BFS で見つからない場合は単一ステップとして追加 */
      const isShinkansen = SHINKANSEN_STATIONS.has(segDest + '駅');
      steps.push({
        type:     isShinkansen ? 'shinkansen' : 'rail',
        from:     steps.length > 0 ? (steps[steps.length - 1].to ?? origin) : origin,
        to:       segDest,
        label:    isShinkansen ? '新幹線' : '鉄道',
        provider: null, operator: null, minutes: null,
      });
    }
  }

  if (steps.length === 0) return null;

  /* finalPoint 注入（BFS と同じロジック） */
  const finalPt = destination.finalPoint
    ?? (Array.isArray(destination.spots) && destination.spots[0]);
  if (finalPt) {
    const lastTo = steps[steps.length - 1]?.to;
    if (lastTo && finalPt !== lastTo) {
      const lastAccessStep = destination.access?.steps?.find(s => s.type === 'local');
      const method = lastAccessStep?.method ?? '徒歩';
      steps.push({
        type: method === 'レンタカー' ? 'localMove' : method === 'バス' ? 'bus' : 'localMove',
        from: lastTo, to: finalPt,
        label: method, provider: null, operator: null,
        minutes: destination.walkMinutes ?? null,
      });
    }
  }

  return { steps, method: 'gateway-chain' };
}

/* ────────────────────────────────────────
   Layer ①: Gateway DB
   destination.gatewayStations + localAccess から明示ルートを構築
   幹線（出発→gateway）は BFS hub-to-hub で展開する。
──────────────────────────────────────── */

function _tryGatewayDb(departure, destination) {
  const stations = destination.gatewayStations;
  if (!stations?.length) return null;

  const fromCity  = DEPARTURE_CITY_INFO[departure];
  const origin    = fromCity?.rail ?? `${departure}駅`;

  /* gatewayStations から最適な gateway を選択（priority 昇順） */
  const gateway = _selectBestGateway(stations, departure);
  if (!gateway) return null;

  const gwName      = gateway.name;
  const localAccess = destination.localAccess;
  const accessSt    = localAccess?.to ?? destination.accessStation ?? destination.name;
  const finalPt     = destination.finalPoint
    ?? (Array.isArray(destination.spots) && destination.spots[0])
    ?? destination.name;

  const steps = [];

  /* ── step 1+: 出発 → gateway（BFS で幹線ステップを展開して追加） ── */
  if (gwName !== origin) {
    const trunkSteps = buildTrunkRoute(departure, gwName);
    if (trunkSteps.length > 0) {
      /* 連続する新幹線ステップを集約（同一トレイン区間は1ステップに表示）
       * 例: 東京→名古屋(新幹線)→大阪(新幹線)→岡山(新幹線)→福山(新幹線)
       *   → 東京→福山（新幹線）[Nozomi は乗り換えなし]
       */
      steps.push(..._collapseConsecutiveShinkansen(trunkSteps));
    } else {
      /* グラフ外の場合: SHINKANSEN_STATIONS から型を推論してシングルステップ */
      steps.push({
        type:     SHINKANSEN_STATIONS.has(gwName) ? 'shinkansen' : 'rail',
        from:     origin,
        to:       gwName,
        label:    SHINKANSEN_STATIONS.has(gwName) ? '新幹線' : '鉄道',
        provider: _deriveProvider(destination),
        operator: null,
        minutes:  null,
      });
    }
  }

  /* ── step N: gateway → accessStation（ローカル線・バス・フェリー等） ── */
  if (accessSt && accessSt !== gwName) {
    const localType  = _localAccessType(localAccess?.type);
    /* 路線名: LOCAL_LINE_MAP → localAccess.description → 型デフォルト の優先順 */
    const localLabel = LOCAL_LINE_MAP[destination.id]
      ?? _buildLocalLabel(localAccess, localType, destination);
    steps.push({
      type:     localType,
      from:     gwName,
      to:       accessSt,
      label:    localLabel,
      provider: null,
      operator: null,
      minutes:  localAccess?.minutes ?? null,
    });
  }

  /* ── step N+1: accessStation → finalPoint（ラストマイル） ── */
  if (finalPt && finalPt !== accessSt && finalPt !== gwName) {
    const { type: finalType, label: finalLabel } = _deriveFinalStep(destination, localAccess);
    steps.push({
      type:     finalType,
      from:     accessSt,
      to:       finalPt,
      label:    finalLabel,
      provider: null,
      operator: null,
      minutes:  destination.walkMinutes ?? null,
    });
  }

  if (steps.length === 0) return null;
  return { steps, method: 'gateway-db' };
}

/* ────────────────────────────────────────
   内部ヘルパー
──────────────────────────────────────── */

/**
 * 連続する新幹線ステップを1ステップに集約する。
 * 東海道→山陽のように同一トレイン（のぞみ等）で乗り換えなしの区間を
 * ユーザーが乗り換えと誤解しないように表示を簡潔にする。
 * 別サービス（サンダーバード→北陸新幹線等）の乗り換えは残す。
 */
function _collapseConsecutiveShinkansen(steps) {
  if (steps.length <= 1) return steps;
  const result = [];
  for (const step of steps) {
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.type === 'shinkansen' &&
      step.type === 'shinkansen' &&
      /* 同じ系統のみ集約: 東海道+山陽、東北+北陸など。
         サービス名が大きく異なる場合（サンダーバード+新幹線 vs 北陸新幹線）は保持 */
      _isSameShinkansen(prev.label, step.label)
    ) {
      prev.to      = step.to;
      prev.minutes = (prev.minutes ?? 0) + (step.minutes ?? 0);
      if (prev.label !== step.label) prev.label = '新幹線';
    } else {
      result.push({ ...step });
    }
  }
  return result;
}

/** 同一列車系統として集約できる新幹線サービスかどうか判定 */
function _isSameShinkansen(labelA, labelB) {
  /* 完全一致は常に同系統 */
  if (labelA === labelB) return true;
  /* 一方が汎用「新幹線」に集約済みの場合: 継続集約として扱う */
  if (labelA === '新幹線' || labelB === '新幹線') return true;
  /* 東海道 ↔ 山陽: のぞみ・ひかり・こだまが通し運転 */
  const TOKAIDO_SANYO = new Set(['東海道新幹線', '山陽新幹線']);
  if (TOKAIDO_SANYO.has(labelA) && TOKAIDO_SANYO.has(labelB)) return true;
  /* 東北 ↔ 上越・北陸: 通し運転はない（別個の路線）*/
  return false;
}

/**
 * ローカルアクセス区間のラベルを構築。
 * LOCAL_LINE_MAP で上書きされない場合のフォールバック。
 */
function _buildLocalLabel(localAccess, localType, destination) {
  /* access.steps から最後のローカル区間のメソッドを参照 */
  const accessSteps = destination.access?.steps;
  if (accessSteps?.length > 0) {
    const localStep = accessSteps.find(s => s.type === 'local');
    if (localStep?.method && localStep.method !== '徒歩') return localStep.method;
  }
  return _localLabel(localType);
}

/**
 * finalPoint へのラストマイル区間タイプとラベルを導出。
 * access.steps の最後のローカルステップメソッドを参照する。
 */
function _deriveFinalStep(destination, localAccess) {
  const accessSteps = destination.access?.steps;
  const lastLocal   = accessSteps?.find(s => s.type === 'local');
  const method      = lastLocal?.method ?? null;

  /* レンタカー */
  if (localAccess?.type === 'rental' || method === 'レンタカー') {
    return { type: 'localMove', label: 'レンタカー' };
  }
  /* バス */
  if (method === 'バス') {
    return { type: 'bus', label: 'バス' };
  }
  /* フェリー */
  if (method === 'フェリー') {
    return { type: 'ferry', label: 'フェリー' };
  }
  /* 徒歩（デフォルト） */
  const mins = destination.walkMinutes;
  return { type: 'localMove', label: mins ? `徒歩${mins}分` : '徒歩' };
}

/**
 * 出発地に最も近い gateway を選択する。
 * priority が低い（＝高優先度）ものを選ぶ。
 */
function _selectBestGateway(stations, departure) {
  if (!stations?.length) return null;
  return [...stations].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0];
}

function _localAccessType(type) {
  switch (type) {
    case 'ferry':  return 'ferry';
    case 'bus':    return 'bus';
    case 'rental': return 'localMove';
    default:       return 'rail';
  }
}

function _localLabel(type) {
  switch (type) {
    case 'ferry':    return 'フェリー';
    case 'bus':      return 'バス';
    case 'localMove': return 'レンタカー';
    default:         return 'ローカル線';
  }
}

function _deriveProvider(destination) {
  return destination.railProvider ?? null;
}

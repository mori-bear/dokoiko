/**
 * routeResolver.js — 3層アーキテクチャ ルート解決エンジン
 *
 * ① Gateway Database（destinations.json の gatewayStations / localAccess）
 * ② Transport Graph（transportGraph.json 上のダイクストラ探索）
 * ③ Route Resolver（このファイル）
 *
 * 解決フロー:
 *   1. Transport Graph BFS（全国幹線ネットワーク最適経路）
 *   2. Gateway DB フォールバック（gatewayStations 明示ルーティング）
 *   3. null → 呼び出し側でパターンビルダーへ降格
 *
 * 返却値:
 *   { steps: Array, method: 'graph'|'gateway-db'|null }
 *
 *   steps 各要素（BFS 形式）:
 *     { type, from, to, label, provider, operator, minutes }
 */

import { buildRoute, buildTrunkRoute } from './bfsEngine.js';
import { DEPARTURE_CITY_INFO } from '../config/constants.js';

/* ─── 新幹線停車駅（step1 ラベル判定） ─── */
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
  /* ── Layer ①: Gateway DB（gatewayStations が設定済みの場合は優先） ── */
  /* 幹線は BFS hub→hub、ローカル区間は DB から取得 → 正確な経路を保証 */
  if (destination.gatewayStations?.length > 0) {
    const gwResult = _tryGatewayDb(departure, destination);
    if (gwResult) return gwResult;
  }

  /* ── Layer ②: Transport Graph フルパス BFS（gateway未設定の場合） ── */
  const bfsResult = _tryBfs(departure, destination);
  if (bfsResult) return bfsResult;

  return null; // 呼び出し側でパターンビルダーへ降格
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
  return { steps, method: 'graph' };
}

/* ────────────────────────────────────────
   Layer ①: Gateway DB
   destination.gatewayStations + localAccess から明示ルートを構築
──────────────────────────────────────── */

function _tryGatewayDb(departure, destination) {
  const stations = destination.gatewayStations;
  if (!stations?.length) return null;

  const fromCity  = DEPARTURE_CITY_INFO[departure];
  const origin    = fromCity?.rail ?? `${departure}駅`;

  /* gatewayStations から最適な gateway を選択（priority 昇順） */
  const gateway = _selectBestGateway(stations, departure);
  if (!gateway) return null;

  const gwName    = gateway.name;
  const localAccess = destination.localAccess;
  const accessSt  = localAccess?.to ?? destination.accessStation ?? destination.name;
  const finalPt   = destination.finalPoint
    ?? (Array.isArray(destination.spots) && destination.spots[0])
    ?? destination.name;

  const steps = [];

  /* step 1: 出発 → gateway（BFS で型を判定し1ステップに集約） */
  if (gwName !== origin) {
    const trunkSteps = buildTrunkRoute(departure, gwName);
    steps.push(_collapseTrunk(trunkSteps, origin, gwName, destination));
  }

  /* step 2: gateway → accessStation（ローカル線・バス等） */
  if (accessSt && accessSt !== gwName) {
    const localType = _localAccessType(localAccess?.type);
    steps.push({
      type:     localType,
      from:     gwName,
      to:       accessSt,
      label:    localAccess?.description ?? _localLabel(localType),
      provider: null,
      operator: null,
      minutes:  null,
    });
  }

  /* step 3: accessStation → finalPoint（ラストマイル） */
  if (finalPt && finalPt !== accessSt && finalPt !== gwName) {
    steps.push({
      type:     'localMove',
      from:     accessSt,
      to:       finalPt,
      label:    '現地移動',
      provider: null,
      operator: null,
      minutes:  null,
    });
  }

  if (steps.length === 0) return null;
  return { steps, method: 'gateway-db' };
}

/* ────────────────────────────────────────
   内部ヘルパー
──────────────────────────────────────── */

/**
 * 幹線ステップ配列を1ステップに集約する。
 * Gateway DB ルートでは origin→gateway 区間はシングルステップで表示。
 * BFS が型判定に使われる: flight > shinkansen > rail
 */
function _collapseTrunk(trunkSteps, origin, gwName, destination) {
  /* BFS が見つからない場合は SHINKANSEN_STATIONS から型推論 */
  if (!trunkSteps || trunkSteps.length === 0) {
    return {
      type:     SHINKANSEN_STATIONS.has(gwName) ? 'shinkansen' : 'rail',
      from:     origin,
      to:       gwName,
      label:    SHINKANSEN_STATIONS.has(gwName) ? '新幹線' : '鉄道',
      provider: _deriveProvider(destination, ''),
      operator: null,
      minutes:  null,
    };
  }

  /* flight が含まれる場合: フライト情報を保持してシングルステップ化 */
  const flightStep = trunkSteps.find(s => s.type === 'flight');
  if (flightStep) {
    return {
      ...flightStep,
      from: origin,
      to:   gwName,
    };
  }

  /* 新幹線が含まれる場合 */
  if (trunkSteps.some(s => s.type === 'shinkansen')) {
    return {
      type:     'shinkansen',
      from:     origin,
      to:       gwName,
      label:    '新幹線',
      provider: null,
      operator: null,
      minutes:  null,
    };
  }

  /* それ以外（在来線特急・バスなど）*/
  const lastStep = trunkSteps[trunkSteps.length - 1];
  return {
    type:     lastStep.type ?? 'rail',
    from:     origin,
    to:       gwName,
    label:    lastStep.label ?? null,
    provider: null,
    operator: null,
    minutes:  null,
  };
}

/**
 * 出発地に最も近い gateway を選択する。
 * priority が低い（＝高優先度）ものを選ぶ。
 * 将来的には出発地からの距離で重み付け可能。
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

function _deriveProvider(destination, departure) {
  // railProvider を destination から取得
  return destination.railProvider ?? null;
}

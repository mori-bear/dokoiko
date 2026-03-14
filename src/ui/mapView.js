/**
 * mapView.js — 行ける旅先マップ
 *
 * Leaflet.js + Leaflet.MarkerCluster で全 destination をマーカー表示。
 * 出発地に応じた travelTime を参照し、カテゴリ色で色分けする。
 *
 * カテゴリ:
 *   daytrip  … < 120 分   → 緑
 *   1night   … 120–300 分 → 黄
 *   2night   … 300–480 分 → 赤
 *   other    … 480 分以上 or 不明 → グレー
 *
 * ※ console.log は [MAP] プレフィクス付きで意図的に出力する。
 */

/* ── 出発地 → travelTime キー ── */
const DEPARTURE_KEY = {
  '東京':  'tokyo',   '横浜':  'tokyo',   '千葉':   'tokyo',
  '大宮':  'tokyo',   '宇都宮':'tokyo',   '仙台':   'tokyo',   '盛岡': 'tokyo',
  '名古屋':'nagoya',  '静岡':  'nagoya',  '長野':   'nagoya',
  '富山':  'nagoya',  '金沢':  'nagoya',
  '大阪':  'osaka',   '京都':  'osaka',   '神戸':   'osaka',   '奈良': 'osaka',
  '広島':  'osaka',   '岡山':  'osaka',   '松江':   'osaka',
  '高松':  'takamatsu','松山': 'takamatsu','高知':  'takamatsu','徳島':'takamatsu',
  '福岡':  'fukuoka', '熊本':  'fukuoka', '鹿児島': 'fukuoka',
  '長崎':  'fukuoka', '宮崎':  'fukuoka',
};

const CATEGORY_COLOR = {
  daytrip: '#22c55e',
  '1night': '#eab308',
  '2night': '#ef4444',
  other:    '#94a3b8',
};

const CATEGORY_LABEL = {
  daytrip: '日帰り圏',
  '1night': '1泊向き',
  '2night': '2泊向き',
  other:    '長距離',
};

/* ── 内部状態 ── */
let _map     = null;
let _cluster = null;
let _dests   = [];

/* ── ログ ── */
function mapLog(msg) {
  console.log(`[MAP] ${msg}`);
}

/* ── travelTime → カテゴリ ── */
function getCategory(dest, departure) {
  const key = DEPARTURE_KEY[departure];
  if (!key || !dest.travelTime) return 'other';
  const minutes = dest.travelTime[key];
  if (minutes === null || minutes === undefined) return 'other';
  if (minutes < 120) return 'daytrip';
  if (minutes < 300) return '1night';
  if (minutes < 480) return '2night';
  return 'other';
}

/* ── 分 → 人間語 ── */
function fmtMin(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

/* ── SVG丸マーカー ── */
function makeIcon(category) {
  const color = CATEGORY_COLOR[category] || '#94a3b8';
  /* global L */
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize:   [12, 12],
    iconAnchor: [6, 6],
    popupAnchor:[0, -10],
  });
}

/* ── マーカー追加 ── */
function _addMarkers(departure) {
  if (!_cluster) return;
  _cluster.clearLayers();

  const refKey = DEPARTURE_KEY[departure] ?? null;

  _dests.forEach(dest => {
    if (!dest.lat || !dest.lng) return;

    const category = getCategory(dest, departure);
    const minutes  = refKey && dest.travelTime ? dest.travelTime[refKey] : null;
    const timeStr  = fmtMin(minutes);
    const catLabel = CATEGORY_LABEL[category];

    const marker = L.marker([dest.lat, dest.lng], { icon: makeIcon(category) });
    marker.bindPopup(`
      <div style="min-width:150px;font-family:sans-serif;line-height:1.5">
        <strong style="font-size:14px">${dest.name}</strong><br>
        <span style="color:#666;font-size:11px">${dest.prefecture}・${dest.region}</span>
        <hr style="margin:6px 0;border:none;border-top:1px solid #eee">
        <div style="font-size:12px">
          ${departure}から: <strong>${timeStr}</strong><br>
          目安: <strong style="color:${CATEGORY_COLOR[category]}">${catLabel}</strong>
        </div>
        <div style="margin-top:8px">
          <a href="/destination/${dest.id}"
             style="display:inline-block;padding:3px 10px;background:#1d4ed8;color:#fff;border-radius:4px;font-size:11px;text-decoration:none">
            詳細を見る →
          </a>
        </div>
      </div>
    `, { maxWidth: 220 });

    _cluster.addLayer(marker);
  });

  mapLog(`マーカー生成完了 (${_dests.length}件, 出発: ${departure})`);
}

/* ── 凡例 ── */
function _buildLegend() {
  const el = document.getElementById('map-legend');
  if (!el) return;
  el.innerHTML = Object.entries(CATEGORY_COLOR).map(([cat, color]) => `
    <span class="map-legend-item">
      <span class="map-legend-dot" style="background:${color}"></span>
      ${CATEGORY_LABEL[cat]}
    </span>
  `).join('');
}

/**
 * 地図を初期化して destination を表示する。
 * @param {Array} destinations
 * @param {string} departure
 */
export function initMap(destinations, departure) {
  mapLog('destination読み込み: ' + destinations.length + '件');

  _dests = destinations.filter(d => d.lat && d.lng);

  const el = document.getElementById('travel-map');
  if (!el || typeof L === 'undefined') return;

  _map = L.map('travel-map', {
    center: [36.5, 136.5],
    zoom: 5,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(_map);

  mapLog('クラスタ生成');
  _cluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        className: 'map-cluster',
        html: `<div>${count}</div>`,
        iconSize: L.point(34, 34),
      });
    },
  });
  _map.addLayer(_cluster);

  _addMarkers(departure);
  _buildLegend();

  mapLog('表示完了');
}

/**
 * 出発地変更時にマーカー色を更新する。
 * @param {string} departure
 */
export function updateMapDeparture(departure) {
  if (!_map) return;
  mapLog('出発地変更 → ' + departure);
  _addMarkers(departure);
}

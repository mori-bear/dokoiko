/**
 * 都市データ生成ヘルパー
 *
 * 新しい都市を destinations.json に追加する際に使用する。
 * 各関数は必須フィールドのデフォルト値を保証し、
 * 構造の一貫性を維持する。
 *
 * 使用例:
 *   createHub({ id:'nagano', name:'長野', region:'中部', distanceStars:2,
 *               departures:['東京'], access:{ railGateway:'長野駅', railBookingProvider:'ekinet' },
 *               atmosphere:[...], themes:[...] })
 */

const DEFAULT_ACCESS = {
  railGateway:         null,
  railNote:            null,
  railBookingProvider: null,
  airportGateway:      null,
  ferryGateway:        null,
};

/**
 * ハブ都市（拠点都市）を作成する。
 * parentHub は常に null。
 */
export function createHub({
  id, name, region, distanceStars,
  stayAllowed = ['1night'],
  departures  = [],
  mapDestination,
  access      = {},
  atmosphere  = [],
  themes      = null,
}) {
  return {
    id,
    name,
    type:          'hub',
    region,
    mapDestination: mapDestination || name,
    parentHub:      null,
    hotelBase:      null,
    distanceStars,
    stayAllowed,
    departures,
    access: { ...DEFAULT_ACCESS, ...access },
    atmosphere,
    themes,
  };
}

/**
 * ローカル都市（町・温泉・自然・小都市）を作成する。
 * parentHub に最寄りのハブ ID を指定する。
 * hotelBase は未指定の場合 parentHub と同じになる。
 */
export function createLocal({
  id, name, region, parentHub, distanceStars,
  stayAllowed = ['daytrip', '1night'],
  hotelBase,
  departures  = [],
  mapDestination,
  access      = {},
  atmosphere  = [],
  themes      = null,
}) {
  return {
    id,
    name,
    type:          'local',
    region,
    mapDestination: mapDestination || name,
    parentHub:      parentHub || null,
    hotelBase:      hotelBase || parentHub || null,
    distanceStars,
    stayAllowed,
    departures,
    access: { ...DEFAULT_ACCESS, ...access },
    atmosphere,
    themes,
  };
}

/**
 * 島都市を作成する。
 * stayAllowed は常に ["1night"]。
 * hotelBase に宿泊検索の拠点ハブ ID を指定する。
 */
export function createIsland({
  id, name, region, parentHub, distanceStars,
  hotelBase,
  departures  = [],
  mapDestination,
  access      = {},
  atmosphere  = [],
  themes      = null,
}) {
  return {
    id,
    name,
    type:          'island',
    region,
    mapDestination: mapDestination || name,
    parentHub:      parentHub || null,
    hotelBase:      hotelBase || parentHub || null,
    distanceStars,
    stayAllowed:    ['1night'],
    departures,
    access: { ...DEFAULT_ACCESS, ...access },
    atmosphere,
    themes,
  };
}

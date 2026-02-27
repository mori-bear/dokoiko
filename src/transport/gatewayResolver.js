import { DEPARTURE_STATIONS, DEPARTURE_AIRPORT_CODES } from '../config/constants.js';

/**
 * 出発地 × 目的地から gateway アイテムを解決する。
 * 存在するカテゴリのみ返す（嘘の交通手段を出さない）。
 */
export function resolveGateway(city, departure) {
  const { gateway } = city;
  const items = [];

  if (gateway.rail) {
    items.push({
      type: 'rail',
      from: DEPARTURE_STATIONS[departure] ?? departure,
      to: gateway.rail.station,
    });
  }

  if (gateway.air) {
    items.push({
      type: 'air',
      fromCode: (DEPARTURE_AIRPORT_CODES[departure] ?? 'TYO').toLowerCase(),
      toCode: gateway.air.code.toLowerCase(),
    });
  }

  if (gateway.bus) {
    items.push({
      type: 'bus',
      from: DEPARTURE_STATIONS[departure] ?? departure,
      to: gateway.bus.terminal,
    });
  }

  if (gateway.ferry) {
    items.push({
      type: 'ferry',
      url: gateway.ferry.url ?? null,
    });
  }

  if (gateway.requiresLocalTransport) {
    items.push({ type: 'rental' });
  }

  return items;
}

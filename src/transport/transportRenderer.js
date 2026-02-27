import { resolveGateway } from './gatewayResolver.js';
import { buildLink } from './linkBuilder.js';

/**
 * 交通リンクの配列を返す。
 * render.js がこれを受け取って HTML に変換する。
 */
export function resolveTransportLinks(city, departure) {
  const items = resolveGateway(city, departure);
  return items.map((item) => buildLink(item)).filter(Boolean);
}

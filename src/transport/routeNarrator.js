/**
 * routeNarrator.js — ルートナレーション生成
 *
 * steps[] → 「北陸新幹線で福井へ。越美北線で越前大野へ。」
 *
 * 生成ルール:
 *   - shinkansen / rail: 路線名（label）+ で〇〇へ
 *   - flight: 飛行機で〇〇へ
 *   - ferry:  フェリーで〇〇へ
 *   - bus:    バスで〇〇へ
 *   - localMove(レンタカー): レンタカーで〇〇へ
 *   - localMove(徒歩): 省略（最終ステップのみ "〇〇まで徒歩" を付記）
 */

/* ── ステップ → フレーズ変換 ── */
function stepToPhrase(step, isLast = false) {
  const rawTo = step.to ?? '';
  const to    = rawTo.replace(/駅$/, '').replace(/空港$/, '').replace(/港$/, '');
  if (!to) return '';

  switch (step.type) {
    case 'shinkansen': {
      const line = step.label ?? '新幹線';
      return `${line}で${to}まで`;
    }

    case 'rail': {
      const line = step.label && step.label !== '鉄道' && step.label !== '電車'
        ? step.label
        : 'ローカル線';
      return `${line}で${to}へ`;
    }

    case 'flight':
      return `飛行機で${to}へ`;

    case 'ferry': {
      const op = step.ferryOperator ? `${step.ferryOperator}フェリーで` : 'フェリーで';
      return `${op}${to}へ`;
    }

    case 'bus': {
      const line = step.label && step.label !== 'バス' ? step.label : 'バス';
      return `${line}で${to}へ`;
    }

    case 'localMove': {
      const method = step.label ?? '徒歩';
      if (method === 'レンタカー') return `レンタカーで${to}へ`;
      if (method === 'バス')       return `バスで${to}へ`;
      if (isLast)                  return `${to}まで徒歩`;
      return '';  // 中間の徒歩は省略
    }

    default:
      return '';
  }
}

/**
 * steps[] からナレーション文字列を生成。
 *
 * @param {Array}  steps     — resolveRoute / BFS のステップ配列
 * @param {string} [departure] — 出発都市名（先頭に付ける場合）
 * @returns {string} ナレーション。生成不能なら ''。
 */
export function buildNarrative(steps, departure = '') {
  if (!steps?.length) return '';

  const phrases = steps.map((s, i) =>
    stepToPhrase(s, i === steps.length - 1)
  ).filter(Boolean);

  if (phrases.length === 0) return '';

  // 文を連結: 末尾以外は "。"、最後も "。" で締める
  return phrases.join('。') + '。';
}

/**
 * step[] のルートスコアを計算する。
 * 高スコア = より人間的に自然で効率的なルート。
 *
 * @param {Array} steps
 * @returns {number} score
 */
export function scoreRoute(steps) {
  if (!steps?.length) return 0;

  let score = 100;

  // 乗換回数ペナルティ（localMove 除外した実乗換）
  const transfers = steps.filter(s =>
    s.type !== 'localMove' && s.type !== 'bus'
  ).length - 1;
  score -= Math.max(0, transfers) * 10;

  // 総所要時間ペナルティ（分 / 60 を減点）
  const totalMin = steps.reduce((t, s) => t + (s.minutes ?? 0), 0);
  score -= totalMin / 60;

  // 徒歩が長い（walkMinutes > 30 相当）ペナルティ
  const longWalk = steps.some(s =>
    s.type === 'localMove' && !s.label && (s.minutes ?? 0) > 30
  );
  if (longWalk) score -= 15;

  // レンタカー必須ペナルティ（スコアは下げるが除外はしない）
  const hasRental = steps.some(s =>
    s.type === 'localMove' && s.label === 'レンタカー'
  );
  if (hasRental) score -= 5;

  return score;
}

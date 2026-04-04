/**
 * date.js — デフォルト日付生成
 * 今日から+7日チェックイン、+8日チェックアウト
 */

export function getDefaultDates() {
  const today   = new Date();
  const checkin = new Date(today);
  checkin.setDate(today.getDate() + 7);
  const checkout = new Date(checkin);
  checkout.setDate(checkin.getDate() + 1);
  return {
    checkin:  format(checkin),
    checkout: format(checkout),
  };
}

function format(d) {
  return d.toISOString().split('T')[0];
}

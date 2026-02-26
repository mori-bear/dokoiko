/**
 * DOM描画 v3
 * 縦導線: 出会い → 行き方（最大3パターン）→ 宿泊
 */

export function renderCityCards(destinations, onSelect) {
  const el = document.getElementById('city-cards');

  if (destinations.length === 0) {
    el.innerHTML = '<p class="empty-state">この条件に合う街は現在準備中です。</p>';
    return;
  }

  el.innerHTML = destinations
    .map(
      (d) => `
      <button class="city-card" data-id="${d.id}">
        <div class="city-card-info">
          <span class="city-card-pref">${d.prefecture}</span>
          ${d.yomi ? `<span class="city-card-yomi">${d.yomi}</span>` : ''}
          <span class="city-card-name">${d.city}</span>
        </div>
        <div class="city-card-cta">プランを見る</div>
      </button>
    `
    )
    .join('');

  el.querySelectorAll('.city-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.city-card').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      const dest = destinations.find((d) => d.id === btn.dataset.id);
      onSelect(dest);
    });
  });
}

/** 手動選択フロー */
export function renderPlan(plan) {
  const el = document.getElementById('plan');
  if (!plan) { el.innerHTML = ''; return; }
  const { destination, transitPatterns, accommodationLinks } = plan;
  el.innerHTML = buildPlanBlocks(destination, transitPatterns, accommodationLinks).join('');
}

/** 抽選フロー: 結果発表 → 出会い → 行き方 → 宿泊 */
export function renderResult(plan) {
  const el = document.getElementById('plan');
  if (!plan) { el.innerHTML = ''; return; }
  const { destination, transitPatterns, accommodationLinks } = plan;
  const blocks = [
    buildDrawBlock(destination),
    ...buildPlanBlocks(destination, transitPatterns, accommodationLinks),
  ];
  el.innerHTML = blocks.join('');
}

/* ── 共通ブロック組み立て ── */

function buildPlanBlocks(destination, transitPatterns, accommodationLinks) {
  const blocks = [buildMeetBlock(destination)];
  if (transitPatterns.length > 0) {
    blocks.push(buildTransitBlock(transitPatterns));
  }
  if (accommodationLinks.length > 0) {
    blocks.push(buildAccBlock(accommodationLinks));
  }
  return blocks;
}

/* ── 個別ブロック ── */

function buildDrawBlock(dest) {
  return `
    <section class="block block-draw" style="animation-delay:0ms">
      <p class="draw-label">あなたの次の旅先</p>
      ${dest.yomi ? `<p class="draw-yomi">${dest.yomi}</p>` : ''}
      <h2 class="draw-city">${dest.city}</h2>
      <p class="draw-station">— ${dest.mainStation} —</p>
      <p class="draw-pref">${dest.prefecture}&ensp;·&ensp;${dest.region}</p>
    </section>
  `;
}

function buildMeetBlock(dest) {
  const highlightHtml =
    dest.highlights && dest.highlights.length > 0
      ? `<ul class="highlights">
           ${dest.highlights
             .slice(0, 3)
             .map((h) =>
               h.url
                 ? `<li><a href="${h.url}" target="_blank" rel="noopener noreferrer">${h.name}</a></li>`
                 : `<li>${h.name}</li>`
             )
             .join('')}
         </ul>`
      : '';

  return `
    <section class="block block-meet" style="animation-delay:0ms">
      <div class="block-eyebrow">出会い</div>
      <div class="appeal">
        ${dest.appeal.map((line) => `<p>${line}</p>`).join('')}
      </div>
      ${dest.yomi ? `<p class="meet-yomi">${dest.yomi}</p>` : ''}
      <h2 class="meet-city">${dest.city}</h2>
      <p class="meet-station">— ${dest.mainStation} —</p>
      <p class="meet-pref">${dest.prefecture}&ensp;·&ensp;${dest.region}</p>
      ${highlightHtml}
    </section>
  `;
}

function buildTransitBlock(patterns) {
  const patternsHtml = patterns
    .map((p) => {
      const linksHtml = p.links
        .map((l) =>
          l.url
            ? `<a href="${l.url}" target="_blank" rel="noopener noreferrer"
                   class="link-btn link-${l.type}">${l.label}</a>`
            : `<p class="local-text">${l.label}</p>`
        )
        .join('');

      return `
        <div class="transit-pattern">
          <div class="pattern-meta">
            <span class="pattern-rank rank-${p.rank}">${p.rankLabel}</span>
            <span class="pattern-duration">${p.duration}</span>
          </div>
          <p class="pattern-desc">${p.desc}</p>
          <div class="link-stack">${linksHtml}</div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="block block-transit" style="animation-delay:80ms">
      <div class="block-eyebrow">行き方</div>
      <div class="transit-patterns">
        ${patternsHtml}
      </div>
    </section>
  `;
}

function buildAccBlock(links) {
  return `
    <section class="block block-acc" style="animation-delay:160ms">
      <div class="block-eyebrow">宿泊</div>
      <div class="link-stack link-stack-row">
        ${links
          .map(
            (l) =>
              `<a href="${l.url}" target="_blank" rel="noopener noreferrer"
                  class="link-btn link-${l.type}">${l.label}</a>`
          )
          .join('')}
      </div>
    </section>
  `;
}

// 計算引擎測試（載入 index.html 中 /*ENGINE-START*/…/*ENGINE-END*/ 區塊）
// Run: node tests.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if (!m) throw new Error('engine block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const TPN = mod.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const near = (a, b, d = 0.05) => assert.ok(Math.abs(a - b) <= d, `${a} ≠ ${b}`);
const base = { weight: 1.2, fluidGoal: 150, population: 'preterm', dol: 3, enType: 'preterm', enVol: 40, enDensity: 0.8, enProtein: 3.0,
  aaDose: 3, lipidDose: 2, dextrosePercent: 10, otherIV: 0, access: 'central' };
const C = o => TPN.calc({ ...base, ...o });
const has = (r, re) => r.warnings.some(w => re.test(w.msg));

console.log('液體與 GIR');
t('1.2 kg 150 ml/kg, EN 40 → PN 132, dex 84 ml', () => { const r = C(); near(r.totalFluid, 180); near(r.enVol, 48); near(r.pnVol, 132); near(r.dexVol, 84); });
t('GIR = 8.4 g ×1000 / (1.2×1440) = 4.86', () => near(C().gir, 4.861, 0.005));
t('其他靜脈液體自 PN 扣除', () => { const r = C({ otherIV: 10 }); near(r.pnVol, 122); near(r.dexVol, 74); });
t('EN 超過總液體 → 錯誤', () => assert.ok(!C({ enVol: 160 }).ok));
t('AA+Lipid 超過空間 → 錯誤', () => assert.ok(!C({ aaDose: 20 }).ok));
t('剩餘空間剛好 0 → 可計算，GIR 0 並警示', () => { const r = C({ enVol: 0, fluidGoal: 40 }); assert.ok(r.ok); near(r.gir, 0); assert.ok(has(r, /剩餘空間為 0/)); });

console.log('熱量與蛋白質');
t('總熱量 87.8 kcal/kg', () => near(C().kcalKg, 87.8));
t('總蛋白 = 3.0 + EN 0.96 = 3.96 g/kg', () => near(C().proteinKg, 3.96, 0.005));
t('母乳蛋白質低於早產配方', () => assert.ok(C({ enType: 'hm', enDensity: 0.67, enProtein: 1.5 }).proteinKg < C().proteinKg));
t('巨量佔比加總 100%', () => { const r = C(); near(r.carbPct + r.proPct + r.fatPct, 100, 1e-6); });
t('NPO 時 EN 佔比 0', () => near(C({ enVol: 0 }).enPct, 0));
t('全 0 PN 與 NPO：NPC:N null 不崩潰', () => { const r = C({ enVol: 0, aaDose: 0, lipidDose: 0, dextrosePercent: 0 }); assert.ok(r.ok); assert.equal(r.npcn, null); });

console.log('輸入檢查');
t('未填體重 → 錯誤', () => assert.ok(!C({ weight: '' }).ok));
t('體重 1200（公克誤植）→ 錯誤', () => assert.ok(!C({ weight: 1200 }).ok));
t('負值胺基酸 → 錯誤', () => assert.ok(!C({ aaDose: -1 }).ok));
t('葡萄糖 >50% → 錯誤', () => assert.ok(!C({ dextrosePercent: 70 }).ok));
t('空白選填欄位視為 0', () => { const r = C({ otherIV: '', enVol: '' }); assert.ok(r.ok); near(r.enVol, 0); });

console.log('ESPGHAN 2018 警示');
t('早產兒第 1 天 GIR 範圍 4–8', () => assert.deepEqual(TPN.girRange('preterm', 1), { lo: 4, hi: 8 }));
t('足月兒第 1 天 GIR 範圍 2.5–5', () => assert.deepEqual(TPN.girRange('term', 1), { lo: 2.5, hi: 5 }));
t('GIR >12 → danger', () => { const r = C({ dextrosePercent: 25, enVol: 0 }); assert.equal(r.girLevel, 'danger'); });
t('早產兒 GIR <4 → 低血糖警示', () => assert.ok(has(C({ dextrosePercent: 5 }), /低於最低 4/)));
t('足月兒 GIR 3 不觸發最低值警示', () => assert.ok(!has(C({ population: 'term', dextrosePercent: 6.5, aaDose: 2 }), /低於最低/)));
t('早產兒 AA 4 → 超過 3.5', () => assert.ok(has(C({ aaDose: 4, fluidGoal: 180 }), /超過早產兒建議上限 3.5/)));
t('足月兒 AA 3.2 → 超過 3.0', () => assert.ok(has(C({ population: 'term', aaDose: 3.2 }), /超過足月兒建議上限 3/)));
t('早產兒 AA 1.0 且無 EN → 應 ≥1.5', () => assert.ok(has(C({ aaDose: 1, enVol: 0 }), /≥1.5/)));
t('脂肪 4.5 → danger', () => assert.ok(C({ lipidDose: 4.5, fluidGoal: 180 }).warnings.some(w => w.lvl === 'danger' && /脂肪/.test(w.msg))));
t('周邊 D15 → 最終濃度 >12.5% 警示', () => assert.ok(has(C({ access: 'peripheral', dextrosePercent: 15, aaDose: 1 }), /12.5%/)));
t('中心靜脈 D15 不警示濃度', () => assert.ok(!has(C({ dextrosePercent: 15, aaDose: 1 }), /12.5%/)));
t('最終濃度 = 葡萄糖 g / (AA+葡萄糖體積)', () => near(C().finalDex, 8.4 / 120 * 100, 0.01));
t('估計滲透壓 = (8.4×5 + 3.6×10)/0.12 = 650', () => near(C().osm, 650, 0.5));
t('早產兒以 PN 為主 → 熱量目標 90–120', () => assert.equal(C({ enVol: 0 }).kcalRange.lo, 90));
t('早產兒以 EN 為主 → 熱量目標 115–140', () => assert.equal(C({ enVol: 140, aaDose: 0, lipidDose: 0 }).kcalRange.lo, 115));

console.log('速率');
t('AA+葡萄糖袋 120 ml/day = 5 ml/hr', () => near(C().rates.bag, 5, 1e-9));
t('脂肪 12 ml/day = 0.5 ml/hr', () => near(C().rates.lipid, 0.5, 1e-9));
t('q3h 每餐 6 ml', () => near(C().rates.feedQ3, 6, 1e-9));

// 教學內容（/*TEACH-START*/…/*TEACH-END*/）與引擎交叉核對
const tm = html.match(/\/\*TEACH-START\*\/([\s\S]*?)\/\*TEACH-END\*\//);
if (!tm) throw new Error('teach block not found');
const tmod = { exports: {} };
new Function('module', tm[1])(tmod);
const { CASES, QUIZ, MAP, SRC } = tmod.exports;
const round = (x, d) => +x.toFixed(d);
const FIELD = { gir: ['gir', 1], kcal: ['kcalKg', 1], pro: ['proteinKg', 1], osm: ['osm', 0], finalDex: ['finalDex', 1], totalFluid: ['totalFluid', 1], pnVol: ['pnVol', 1], bagVol: ['bagVol', 0], enPct: ['enPct', 0], lipidVol: ['lipidVol', 1], lipidKcal: ['lipidKcal', 1] };
function matches(input, expect) {
  const r = TPN.calc(input);
  assert.ok(r.ok, (r.errors || []).join());
  Object.entries(expect).forEach(([k, v]) => { const [f, d] = FIELD[k]; assert.equal(round(r[f], d), v, k); });
  return r;
}

console.log('示範病例');
t('6 例、id 不重複', () => { assert.equal(CASES.length, 6); assert.equal(new Set(CASES.map(c => c.id)).size, 6); });
CASES.forEach(c => {
  t(`${c.id} 數字與引擎一致`, () => { matches(c.input, c.expect); c.alts.forEach(a => matches(a.input, a.expect)); });
  t(`${c.id} 解析提到的 GIR 與熱量為引擎算出值`, () => {
    const text = c.steps.map(s => s.t).join(' ') + c.pitfall;
    [String(c.expect.gir), String(c.expect.kcal)].concat(c.alts.filter(a => a.expect.gir).map(a => String(a.expect.gir))).forEach(n => assert.ok(text.includes(n), n));
  });
  t(`${c.id} 有步驟、陷阱、依據`, () => { assert.ok(c.steps.length >= 4); assert.ok(c.pitfall); assert.ok(c.src.length); });
});
t('c1 液體在 <1000 g 第 1 天 80–100', () => { const f = CASES[0].input.fluidGoal; assert.ok(f >= 80 && f <= 100); });
t('c2 液體在 <1000 g 第 3 天 120–140', () => { const f = CASES[1].input.fluidGoal; assert.ok(f >= 120 && f <= 140); });
t('c1 修正後 GIR 在 4–8、熱量 ≥45', () => { const r = TPN.calc(CASES[0].input); assert.ok(r.gir >= 4 && r.gir <= 8 && r.kcalKg >= 45); });
t('c1 初稿低於 GIR 4 且引擎警示', () => assert.ok(has(TPN.calc(CASES[0].alts[0].input), /低於最低 4/)));
t('c4 初稿滲透壓警示，修正後不警示', () => {
  assert.ok(has(TPN.calc(CASES[3].alts[0].input), />\s*900/));
  assert.ok(!has(TPN.calc(CASES[3].input), />\s*900/));
});
t('c4 電解質算術：8 mOsm/kg × 1.9 kg ÷ 152 ml ≈ 100', () => near(8 * 1.9 / 0.152, 100, 0.01));
t('c5 足月 AA 未超上限，無警示', () => assert.equal(TPN.calc(CASES[4].input).warnings.length, 0));
t('c6 GIR 落在敗血症暫用的 4–8', () => { const r = TPN.calc(CASES[5].input); assert.ok(r.gir >= 4 && r.gir <= 8); });

console.log('考題');
t('20 題：基礎 10、高階 10', () => {
  assert.equal(QUIZ.length, 20);
  assert.equal(QUIZ.filter(q => q.lv === 'basic').length, 10);
  assert.equal(QUIZ.filter(q => q.lv === 'adv').length, 10);
});
t('每題 4 選項、不重複、有解析與依據', () => QUIZ.forEach(q => {
  assert.equal(q.o.length, 4); assert.equal(new Set(q.o).size, 4); assert.ok(q.e && q.s); assert.ok(q.a >= 0 && q.a < 4);
}));
t('正解 A–D 各 5 題', () => [0, 1, 2, 3].forEach(k => assert.equal(QUIZ.filter(q => q.a === k).length, 5)));
t('正解為唯一最長選項的題目 ≤6', () => {
  const n = QUIZ.filter(q => { const l = q.o.map(x => x.length); return l[q.a] === Math.max(...l) && l.filter(x => x === l[q.a]).length === 1; }).length;
  assert.ok(n <= 6, `${n} 題`);
});
QUIZ.forEach((q, i) => { if (q.calc) t(`第 ${i + 1} 題計算與引擎一致`, () => matches(Object.assign({ population: 'preterm', enType: 'preterm', enVol: 0, enDensity: 0.8, enProtein: 3, otherIV: 0, access: 'central' }, q.calc), q.check)); });
const ans = n => QUIZ[n - 1].o[QUIZ[n - 1].a];
t('第 2 題 = R3.1', () => assert.ok(ans(2).includes('1.5')));
t('第 4 題 = R4.3', () => assert.ok(ans(4).includes('4 g')));
t('第 5 題與引擎 girRange 一致', () => { const g = TPN.girRange('preterm', 1); assert.ok(ans(5).startsWith(`${g.lo}–${g.hi}`)); });
t('第 16 題 Cl：5 − Cl = 1–2', () => assert.ok(ans(16).startsWith('3–4')));

console.log('心智圖與來源');
t('9 個分支，每支至少 4 葉、皆有依據', () => {
  assert.equal(MAP.branches.length, 9);
  MAP.branches.forEach(b => { assert.ok(b.leaves.length >= 4); b.leaves.forEach(l => { assert.ok(/^<b>.*?<\/b>/.test(l.t)); assert.ok(l.s); }); });
});
t('來源皆有連結與核對範圍', () => SRC.forEach(s => assert.ok(/^https:/.test(s.u) && s.r)));
t('頁面有四個分頁掛載點', () => ['view-calc', 'view-cases', 'view-quiz', 'view-map'].forEach(id => assert.ok(html.includes(`id="${id}"`))));

console.log('v2.2 目標修正');
t('AA 剛好 1.5（1.9 kg）不誤報', () => assert.ok(!has(C({ weight: 1.9, aaDose: 1.5, enVol: 0, lipidDose: 2, fluidGoal: 90 }), /≥1.5/)));
t('AA 1.4 仍警示', () => assert.ok(has(C({ weight: 1.9, aaDose: 1.4, enVol: 0, lipidDose: 2, fluidGoal: 90 }), /≥1.5/)));
const D1 = { dol: 1, enVol: 0, fluidGoal: 90, weight: 0.85, otherIV: 10, aaDose: 2.5, lipidDose: 1.5, dextrosePercent: 15 };
t('早產第 1 天熱量目標 45 起，48.3 不標橘色', () => { const r = C(D1); assert.equal(r.kcalRange.lo, 45); assert.equal(r.kcalLevel, 'ok'); });
t('早產第 1 天熱量 36 仍標橘色', () => assert.equal(C({ ...D1, aaDose: 2, lipidDose: 1, dextrosePercent: 10 }).kcalLevel, 'warn'));
t('早產第 1 天蛋白質目標 ≥1.5，第 2 天 ≥2.5', () => { assert.equal(C(D1).proRange.lo, 1.5); assert.equal(C({ ...D1, dol: 2 }).proRange.lo, 2.5); });
const T = { population: 'term', enVol: 0, weight: 3.2, fluidGoal: 120, dol: 8, aaDose: 3, lipidDose: 3, dextrosePercent: 15 };
t('足月 PN 熱量依階段', () => {
  assert.deepEqual([C({ ...T, phase: 'acute' }).kcalRange.lo, C({ ...T, phase: 'stable' }).kcalRange.lo, C({ ...T, phase: 'recovery' }).kcalRange.lo], [45, 60, 75]);
});
t('未填階段視為恢復期', () => assert.equal(C(T).phase, 'recovery'));
t('足月腸道為主不受階段影響', () => assert.equal(C({ ...T, enVol: 100, aaDose: 0, lipidDose: 0, phase: 'acute' }).kcalRange.lo, 100));
t('急性期 <28 天：早產 GIR 4–8、足月 2.5–5', () => { assert.deepEqual(TPN.girRange('preterm', 24, 'acute'), { lo: 4, hi: 8 }); assert.deepEqual(TPN.girRange('term', 24, 'acute'), { lo: 2.5, hi: 5 }); });
t('急性期 ≥28 天不套用第 1 天', () => assert.deepEqual(TPN.girRange('preterm', 28, 'acute'), { lo: 8, hi: 10 }));
t('穩定期不改 GIR', () => assert.deepEqual(TPN.girRange('preterm', 24, 'stable'), { lo: 8, hi: 10 }));
t('急性期有提示，且早產熱量不標橘色', () => {
  const r = C({ weight: 1.6, fluidGoal: 140, dol: 24, enVol: 0, phase: 'acute', aaDose: 3.5, lipidDose: 1, dextrosePercent: 10, otherIV: 12 });
  assert.ok(r.warnings.some(w => w.lvl === 'info' && /第 1 天供應量 4–8/.test(w.msg)));
  assert.equal(r.kcalLevel, 'ok'); assert.equal(r.girLevel, 'ok');
});
t('周邊 >12.5% 為黃色提示，>900 mOsm/L 仍紅色', () => {
  const r = C({ access: 'peripheral', dextrosePercent: 25, aaDose: 1, enVol: 0, weight: 1.2, lipidDose: 0, fluidGoal: 100 });
  assert.equal(r.warnings.find(w => /12.5%/.test(w.msg)).lvl, 'warn');
  assert.equal(r.warnings.find(w => /900/.test(w.msg)).lvl, 'danger');
});
t('非蛋白熱量 = (總熱量 − 蛋白 ×4) ÷ 體重', () => { const r = C(); near(r.npKcalKg, r.kcalKg - r.proteinKg * 4, 1e-9); });
t('c6 帶入急性期後 GIR 與熱量皆不標橘色', () => { const r = TPN.calc(CASES[5].input); assert.equal(r.girLevel, 'ok'); assert.equal(r.kcalLevel, 'ok'); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

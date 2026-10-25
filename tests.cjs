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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

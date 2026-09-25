# 新生兒 TPN 與腸道營養計算器 (Neonatal TPN & Nutrition Calculator)

這是一個專為新生兒加護病房 (NICU) 醫師與臨床營養師團隊開發的單頁式 Web 應用程式 (SPA)。本工具能自動化處理早產兒與新生兒複雜的腸道外營養 (Parenteral Nutrition, PN) 與腸道營養 (Enteral Nutrition, EN) 處方計算，即時分析葡萄糖輸注速率 (GIR)、巨量營養素分佈及熱量達標率。

## ✨ 核心功能 (Features)

*   **智能液體分配邏輯 (Smart Fluid Allocation)：** 輸入總液體目標與腸道餵食量後，系統會自動結算剩餘的靜脈輸液空間 (PN Volume)。
*   **反推式 GIR 計算 (Reverse GIR Calculation)：** 貼近真實開方邏輯，系統會優先保留體積給胺基酸 (AA) 與脂肪乳劑 (Lipid)，將「剩餘的點滴空間」自動轉換為葡萄糖輸注液，進而精準反推目前的 **GIR (mg/kg/min)**，並透過顏色警示過低 (< 4) 或過高 (> 12) 的風險。
*   **巨量營養與熱量分析 (Macronutrients Breakdown)：** 
    *   自動加總 PN 與 EN 雙管齊下的總熱量 (kcal/kg/day)。
    *   導入 Chart.js 圓餅圖，視覺化呈現醣類、蛋白質與脂肪的熱量佔比。
    *   自動換算 **非蛋白質熱量氮比 (NPC:N Ratio)**，協助評估蛋白質合成效益。
*   **處方箋匯出 (PDF Export)：** 內建專為病歷歸檔設計的列印排版，匯出乾淨的處方明細，並具備「醫師」與「營養師」雙簽章欄位，利於跨職類團隊核對。
*   **離線支援 (PWA)：** 支援安裝至手機或平板主畫面，在無網路環境下依然能流暢執行所有精算。

## 📚 參考臨床指引 (Clinical Guidelines)

*   **營養需求標準：** 參考 ESPGHAN / ASPEN (歐洲/美國靜脈暨腸道營養醫學會) 針對早產兒與新生兒之腸道外營養給予指引。
*   **熱量換算基準：** 
    *   Dextrose (葡萄糖): $3.4 \text{ kcal/g}$
    *   Amino Acid (胺基酸): $4.0 \text{ kcal/g}$
    *   20% Lipid Emulsion (脂肪乳劑): $10.0 \text{ kcal/g} \text{ (即 2 kcal/ml)}$

## 🚀 部署與安裝 (Deployment)

本專案為純前端架構 (HTML/CSS/JS)，無須建置後端伺服器。

1.  **線上發布 (GitHub Pages)：**
    進入 GitHub 專案的 `Settings > Pages`，將 Branch 設為 `main` 即可自動生成對外網址。
2.  **行動裝置安裝 (PWA)：**
    使用行動裝置瀏覽器 (Safari / Chrome) 開啟網頁後，選擇 **「加入主畫面 (Add to Home Screen)」** 即可建立桌面捷徑並啟用離線功能。

## 📁 檔案結構 (File Structure)

```text
├── index.html       # 系統主程式 (包含液體分配、GIR 公式與 Chart.js 圓餅圖設定)
├── manifest.json    # PWA 應用程式清單
├── sw.js            # PWA Service Worker (處理離線快取)
└── icons/           # 放置 192x192 與 512x512 的 APP 圖示
## ⚠️ 免責聲明 (Disclaimer)

本計算機旨在提供臨床醫療人員快速估算與視覺化輔助，**絕對不能取代醫師與營養師獨立的臨床判斷**。
* 為簡化速算流程，本系統**未將**微量元素 (Trace elements)、維生素及額外電解質的體積納入 PN 總體積扣除項目中。在實際調配高濃度 TPN 時，需考量上述添加物佔用的液體空間。
* 系統中對配方奶 (EN) 的巨量營養素拆解為簡化估算，實際數值會依不同廠牌的配方奶或母乳添加劑 (HMF) 有所差異。
* 開發者已盡力確保計算邏輯之準確性，但對於因使用本工具而產生的任何臨床處方與醫療後果，開發者不承擔法律及醫療責任。

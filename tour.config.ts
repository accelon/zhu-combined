// 操作導覽的編譯設定（self-explaining-tour）。
// 從專案根目錄執行：
//   bun run src/tour/build-tours.ts --config tour.config.ts
//   bun run src/tour/build-tours.ts --config tour.config.ts --check
import { defineTourConfig } from './src/tour/compiler';

// 劇本與成品可以放在內容工作區（build-tour.mjs --root）；路徑用環境變數覆寫。
const env = (k: string, d: string): string => process.env[k] || d;

export default defineTourConfig({
  tourDir: env('TOUR_DIR', './tours'),
  outFile: env('TOUR_OUT', './src/tour/tour-data.ts'),
  templateFile: env('TOUR_TPL', './index.html'), // 讓 #id 打錯在編譯時就失敗
  formatImport: './format',
  appName: env('TOUR_APP', '經注閱讀器'),
  setKeys: ['theme'],
  callNames: ['pickSentence', 'openNotes', 'openAlt', 'openPhrase', 'closePanel', 'reset', 'openSearch', 'closeSearch'],
  tabNames: ['works', 'alt', 'phrase'],
  apiKeys: ['ready', 'section', 'selected', 'panel', 'tab', 'overlay'],
  // 科判層（src/kepan/kepan.js）執行時才長出來的 id
  dynamicIds: ['tourHint', 'kepanBar', 'kbTrail', 'kbNav', 'kbNavBottom', 'kbEd', 'kbTree', 'kbToggle'],
});

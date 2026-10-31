// 操作導覽的編譯設定（self-explaining-tour）。
// 從專案根目錄執行：
//   bun run src/tour/build-tours.ts --config tour.config.ts
//   bun run src/tour/build-tours.ts --config tour.config.ts --check
import { defineTourConfig } from './src/tour/compiler';

export default defineTourConfig({
  tourDir: './tours',
  outFile: './src/tour/tour-data.ts',
  templateFile: './index.html', // 讓 #id 打錯在編譯時就失敗
  formatImport: './format',
  appName: '金剛經合注',
  setKeys: ['theme'],
  callNames: ['pickSentence', 'openNotes', 'openAlt', 'openPhrase', 'closePanel', 'reset'],
  tabNames: ['works', 'alt', 'phrase'],
  apiKeys: ['ready', 'section', 'selected', 'panel', 'tab', 'overlay'],
  dynamicIds: ['tourHint'],
});

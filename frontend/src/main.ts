import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { WidgetApp } from './app/widget/widget-app';

// 兩扇 PhotinoWindow（主視窗 + 浮動小工具）載入同一份 index.html（見 backend/Program.cs），
// widget 那扇多帶了 `?mode=widget`，這裡就是唯一的分流點——bootstrap 哪個 component class
// 決定了這個視窗實例要長成主畫面還是小工具，兩者共用 selector `app-root`（見 widget-app.ts）。
const isWidget = new URLSearchParams(location.search).get('mode') === 'widget';

bootstrapApplication(isWidget ? WidgetApp : App, appConfig)
  .catch((err) => console.error(err));

import { mountSlideshow, showSlideshowSettings } from './slideshow.js';
export const isAndroid = Boolean(window.DangerRoomAndroid);
export function mobileHome(app) {
  app.innerHTML = `<div class="mobile-menu">${[['/wants','shopping-list','Want List'],['/collection','boxes','My Collection'],['/','metron','Search Metron'],['/slideshow','slideshow','Cover Slideshow'],['/reading-log','reading-log','Reading Log']].map(([path, icon, label])=>`<a class="mobile-menu-item" href="#${path}"><img src="/${icon}.${icon==='metron'?'svg':'png'}" alt="">${label}<span aria-hidden="true">›</span></a>`).join('')}</div><div class="mobile-settings-actions"><button id="mobile-settings" class="secondary">Instance and device settings</button><button id="slideshow-settings" class="secondary">Slideshow settings</button></div>`;
  document.querySelector('#mobile-settings').onclick = () => window.DangerRoomAndroid.settings();
  document.querySelector('#slideshow-settings').onclick = () => showSlideshowSettings(app);
}
export async function mobilePage(path, app, api, current) {
  if (path === '/slideshow') { await mountSlideshow(app, api, current); return true; }
  return false;
}

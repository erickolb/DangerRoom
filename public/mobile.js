import { mountSlideshow, showSlideshowSettings } from './slideshow.js';
export const isAndroid = Boolean(window.DangerRoomAndroid);
// Older Android and iOS clients keep their existing menu until their native gate supports subscriptions.
export const supportsSubscriptions = !isAndroid || (typeof window.DangerRoomAndroid.supportsSubscriptions==='function' && window.DangerRoomAndroid.supportsSubscriptions()===true);
export function mobileHome(app) {
  app.innerHTML = `<div class="mobile-menu">${[...(supportsSubscriptions?[['/subscriptions','subscriptions','Subscriptions']]:[]),['/wants','shopping-list','Want List'],['/collection','boxes','My Collection'],['/','metron','Search Metron'],['/?mode=upc','barcode','UPC Mode'],...(typeof window.DangerRoomAndroid.imageCoverSearch==='function'?[['/image-cover-search','image-search','Image Cover Search']]:[]),['/slideshow','slideshow','Cover Slideshow'],['/reading-log','reading-log','Reading Log']].map(([path, icon, label])=>`<a class="mobile-menu-item" href="#${path}"><img src="/${icon}.${['metron','barcode'].includes(icon)?'svg':'png'}" alt="">${label}<span aria-hidden="true">›</span></a>`).join('')}</div><div class="mobile-settings-actions"><button id="mobile-reload" class="secondary">Reload</button><button id="mobile-settings" class="secondary">Instance and device settings</button><button id="slideshow-settings" class="secondary">Slideshow settings</button></div>`;
  document.querySelector('#mobile-reload').onclick = () => window.location.reload();
  document.querySelector('#mobile-settings').onclick = () => window.DangerRoomAndroid.settings();
  document.querySelector('#slideshow-settings').onclick = () => showSlideshowSettings(app);
}
export async function mobilePage(path, app, api, current) {
  if(path==='/image-cover-search' && isAndroid && typeof window.DangerRoomAndroid.imageCoverSearch==='function'){app.innerHTML='<p class=loading>Opening Image Cover Search…</p>';window.DangerRoomAndroid.imageCoverSearch();return true;}
  if (path === '/slideshow') { await mountSlideshow(app, api, current); return true; }
  return false;
}

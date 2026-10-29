import { changeRead } from './reading-log.js';
const icons = { owned:'box-add', wanted:'shopping-list', read:'book-check', extra:'duplicate', black_bag:'black-bag' };
const names = { owned:'Add to collection', wanted:'Add to Want List', read:'Mark as read', extra:'Add another copy', black_bag:'Black bag this cover' };
export function actionButton(action, active = false, disabled = false) {
  const title = action === 'black_bag' ? 'Black Bag - Hide from Cover Slideshow display' : action === 'owned' && active ? 'Remove this copy from collection' : action === 'wanted' && active ? 'Remove from Want List' : action === 'read' && active ? 'Mark unread' : names[action];
  return `<button type="button" class="comic-toggle ${action === 'extra' ? 'extra-copy' : ''}" data-action="${action}" aria-label="${action==='black_bag'?title:names[action]}" title="${title}" ${action !== 'extra' ? `aria-pressed="${Boolean(active)}"` : ''} ${disabled ? 'disabled' : ''}><img class="icon" src="/${icons[action]}.${action==='black_bag'?'svg':'png'}" alt=""></button>`;
}
export function context(issue, api, onError) {
  const ctx = { issue, editions:issue.editions || [], saved:issue.saved ?? Boolean(issue.saved_at), busy:false, listeners:new Set(), api,onError };
  ctx.notify=()=>{ for(const listener of [...ctx.listeners])listener(); };
  ctx.sync=fresh=>{
    ctx.saved=true;
    const incoming=new Map(fresh.editions.map(e=>[e.key,e]));
    ctx.editions=ctx.editions.map(e=>({...e,...incoming.get(e.key),owned:fresh.copies.some(c=>c.edition_key===e.key)}));
    for(const e of fresh.editions)if(!ctx.editions.some(existing=>existing.key===e.key))ctx.editions.push(e);
    ctx.issue={...ctx.issue,...fresh,editions:ctx.editions};
  };
  return ctx;
}
export function copyState(ctx, editionKey, copyId) {
  return { editionKey, copyId:copyId === undefined ? ctx.issue.copies?.find(c=>c.edition_key===editionKey)?.id || null : copyId };
}
export function bindToggles(container,ctx,state,{actions=['owned','wanted','read'],extra=false}={}) {
  function render(){
    const selected=ctx.editions.find(e=>e.key===state.editionKey);
    const focused=container.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    container.innerHTML=actions.map(action=>actionButton(action,action==='owned'?Boolean(state.copyId):action==='wanted'?selected?.wanted:action==='black_bag'?selected?.black_bagged:Boolean(ctx.issue.read),ctx.busy || !selected || action==='wanted' && selected.owned || action==='extra' && !selected.owned)).join('')+(extra?actionButton('extra',false,ctx.busy || !selected?.owned):'');
    container.querySelectorAll('button').forEach(button=>button.onclick=()=>perform(button.dataset.action));
    if(focused && !ctx.busy)container.querySelector(`[data-action=${focused}]`)?.focus({preventScroll:true});
  }
  async function perform(action){
    if(ctx.busy)return;
    const edition=ctx.editions.find(e=>e.key===state.editionKey);
    if(!edition || action==='wanted' && edition.owned)return;
    if(action==='read')return changeRead(ctx,state);
    ctx.busy=true;ctx.notify();
    try{
      if(action==='owned' && state.copyId){
        await ctx.api(`/copies/${state.copyId}`,{method:'DELETE'});
        state.copyId=null;
        ctx.sync(await ctx.api(`/issues/${ctx.issue.id}`));
      }else if(action==='owned' || action==='extra'){
        const result=await ctx.api('/entries',{method:'POST',body:JSON.stringify({issue_id:ctx.issue.id,edition_key:edition.key,owned:true,read:false})});
        if(action==='owned')state.copyId=result.copy_id;
        ctx.sync(result.issue);
      }else if(action==='black_bag'){
        ctx.sync(await ctx.api(`/issues/${ctx.issue.id}/black-bag`,{method:'PATCH',body:JSON.stringify({edition_key:edition.key,black_bagged:!edition.black_bagged})}));
      }else if(action==='wanted'){
        if(edition.wanted){await ctx.api(`/wants/${ctx.issue.id}/${edition.key}`,{method:'DELETE'});edition.wanted=false;}
        else{const result=await ctx.api('/wants',{method:'POST',body:JSON.stringify({issue_id:ctx.issue.id,edition_key:edition.key})});Object.assign(edition,{owned:result.owned,wanted:result.wanted});}
      }
    }catch(error){ctx.onError(error.message);}
    finally{ctx.busy=false;ctx.notify();}
  }
  ctx.listeners.add(render);render();
  return ()=>ctx.listeners.delete(render);
}

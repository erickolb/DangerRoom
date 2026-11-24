import { ratingChoices, bindRatingPreview } from './ratings.js';
export function localToday(now=new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function shiftMonth(month,delta) {
  const [year,number]=month.split('-').map(Number);const date=new Date(0);
  date.setFullYear(year,number-1+delta,1);date.setHours(12,0,0,0);
  return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
export function calendarDays(month) {
  const [year,number]=month.split('-').map(Number);
  const first=new Date(0);first.setFullYear(year,number-1,1);first.setHours(12,0,0,0);
  const last=new Date(first);last.setMonth(last.getMonth()+1,0);
  return [...Array(first.getDay()).fill(null),...Array.from({length:last.getDate()},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}
function mountCalendar(container,value,onSelect) {
  let selected=value,month=value.slice(0,7);
  function render(){
    const title=new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'});
    container.innerHTML=`<div class="inline-calendar-nav"><button type="button" class="quiet" data-calendar-prev aria-label="Previous calendar month" ${month==='0001-01'?'disabled':''}>‹</button><strong>${title}</strong><button type="button" class="quiet" data-calendar-next aria-label="Next calendar month" ${month==='9999-12'?'disabled':''}>›</button></div><div class="inline-calendar-grid">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${calendarDays(month).map(day=>day ? `<button type="button" class="calendar-day" data-calendar-date="${day}" aria-label="${new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}" aria-pressed="${day===selected}" ${day===localToday()?'aria-current="date"':''}>${Number(day.slice(8))}</button>`:'<span aria-hidden="true"></span>').join('')}</div><p class="hint calendar-selected-date">Selected: ${new Date(selected+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</p>`;
    container.querySelector('[data-calendar-prev]').onclick=()=>{month=shiftMonth(month,-1);render();};
    container.querySelector('[data-calendar-next]').onclick=()=>{month=shiftMonth(month,1);render();};
    container.querySelectorAll('[data-calendar-date]').forEach(button=>button.onclick=()=>{
      selected=button.dataset.calendarDate;onSelect(selected);render();
      container.querySelector(`[data-calendar-date="${selected}"]`).focus({preventScroll:true});
    });
  }
  render();
}
export function cancelReadDialog(){const dialog=document.querySelector('#read-dialog');if(dialog?.open)dialog.close();}
function readPrompt({logOnly=false,rating=null,recoveryState=null}={}) {
  const dialog=document.querySelector('#read-dialog');
  if(dialog.open)return Promise.resolve(null);
  return new Promise(resolve=>{
    let result=null;
    dialog.innerHTML=`<h2 id="read-dialog-title">${logOnly?'Add Reading Log Entry':'Reading status and journal'}</h2><form id="read-log-form">${logOnly?'':'<label class="record-log-switch"><input type="checkbox" role="switch" id="read-status" checked>Mark as read</label><label class="record-log-switch" id="preserve-label" hidden><input type="checkbox" role="switch" id="preserve-journal" checked>Preserve reading journal entries</label><label class="record-log-switch"><input type="checkbox" role="switch" id="record-reading">Record a reading journal entry</label>'}<fieldset class="reading-calendar"><legend>Reading date</legend><div class="inline-calendar" id="reading-calendar"></div><input type="hidden" name="log_date" value="${localToday()}"></fieldset>${logOnly?'':ratingChoices(rating).replace('Your rating','Your rating (optional)')}<div class="actions"><button type="submit">OK</button><button type="button" class="quiet" data-cancel>Cancel</button></div></form>`;
    dialog.addEventListener('close',()=>{
      document.removeEventListener('recoveryfields',refreshDraft);
      document.dispatchEvent(new CustomEvent('recoveryread',{detail:null}));
      resolve(result);
    },{once:true});
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    const form=dialog.querySelector('form'),read=dialog.querySelector('#read-status'),toggle=dialog.querySelector('#record-reading'),date=form.querySelector('[name=log_date]');
    if(read)read.onchange=()=>{
      toggle.disabled=!read.checked;
      dialog.querySelector('#preserve-label').hidden=read.checked;
      dialog.querySelector('.reading-calendar').disabled=!read.checked;
      form.querySelectorAll('[name=rating]').forEach(input=>input.disabled=!read.checked);
    };
    mountCalendar(dialog.querySelector('#reading-calendar'),date.value,day=>{date.value=day;if(toggle)toggle.checked=true;});
    function refreshDraft(){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date.value))date.value=localToday();
      mountCalendar(dialog.querySelector('#reading-calendar'),date.value,day=>{date.value=day;if(toggle)toggle.checked=true;});
      read?.onchange();
    }
    document.addEventListener('recoveryfields',refreshDraft);
    if(!logOnly)bindRatingPreview(form);
    form.onsubmit=event=>{
      event.preventDefault();result={read:logOnly||read.checked};
      if(result.read){if(logOnly||toggle.checked)result.log_date=date.value;const score=form.querySelector('[name=rating]:checked');if(score)result.rating=Number(score.value);}
      else result.remove_log_entries=!dialog.querySelector('#preserve-journal').checked;
      dialog.close();
    };
    dialog.showModal();
    document.dispatchEvent(new CustomEvent('recoveryread',{detail:recoveryState}));
  });
}
export async function changeRead(ctx,state,{logOnly=false}={}) {
  if(ctx.busy||!state.editionKey)return;
  ctx.busy=true;ctx.notify();
  try{
    const choice=await readPrompt({logOnly,rating:ctx.issue.user_rating??null,recoveryState:{id:Number(ctx.issue.id),edition:state.editionKey,logOnly}});if(choice===null)return;
    if(ctx.saved)ctx.sync(await ctx.api(`/issues/${ctx.issue.id}/read`,{method:'PATCH',body:JSON.stringify({edition_key:state.editionKey,...choice})}));
    else if(choice.read)ctx.sync((await ctx.api('/entries',{method:'POST',body:JSON.stringify({issue_id:ctx.issue.id,edition_key:state.editionKey,owned:false,...choice})})).issue);
  }catch(error){ctx.onError(error.message);}
  finally{ctx.busy=false;ctx.notify();}
}

export function mountMonthPicker(container,value,onSelect){
  let year=Number(value.slice(0,4));
  function render(){
    container.innerHTML=`<details class="month-picker"><summary class="button quiet" aria-label="Choose reading log month and year">${new Date(value+'-15T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'})}</summary><div class="month-picker-panel"><div class="inline-calendar-nav"><button type="button" class="quiet" data-year-prev aria-label="Previous year" ${year===1?'disabled':''}>‹</button><strong aria-live="polite">${year}</strong><button type="button" class="quiet" data-year-next aria-label="Next year" ${year===9999?'disabled':''}>›</button></div><div class="month-picker-grid">${Array.from({length:12},(_,index)=>{const month=String(index+1).padStart(2,'0'),key=String(year).padStart(4,'0')+'-'+month;return `<button type="button" class="quiet" data-month="${key}" aria-pressed="${key===value}">${new Date('2000-'+month+'-15T12:00:00').toLocaleDateString(undefined,{month:'short'})}</button>`;}).join('')}</div><button type="button" class="quiet month-picker-today" data-this-month>This Month</button></div></details>`;
    container.querySelector('[data-year-prev]').onclick=()=>{year--;render();container.querySelector('details').open=true;container.querySelector('[data-year-prev]').focus();};
    container.querySelector('[data-year-next]').onclick=()=>{year++;render();container.querySelector('details').open=true;container.querySelector('[data-year-next]').focus();};
    container.querySelector('[data-this-month]').onclick=()=>{container.querySelector('details').open=false;onSelect(localToday().slice(0,7));};
    container.querySelectorAll('[data-month]').forEach(button=>button.onclick=()=>{container.querySelector('details').open=false;onSelect(button.dataset.month);});
    container.onkeydown=event=>{if(event.key==='Escape'){container.querySelector('details').open=false;container.querySelector('summary').focus();}};
  }
  render();
}

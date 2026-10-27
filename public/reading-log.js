export function localToday(now=new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function shiftMonth(month,delta) {
  const [year,number]=month.split('-').map(Number);const date=new Date(0);
  date.setFullYear(year,number-1+delta,1);date.setHours(12,0,0,0);
  return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
export function cancelReadDialog(){const dialog=document.querySelector('#read-dialog');if(dialog?.open)dialog.close();}
function readPrompt({logOnly=false,count=0,unread=false}={}) {
  const dialog=document.querySelector('#read-dialog');
  if(dialog.open)return Promise.resolve(null);
  return new Promise(resolve=>{
    let result=null;
    dialog.innerHTML=unread
      ? `<h2 id="read-dialog-title">Mark As Unread</h2><p>This issue has ${count} reading log ${count===1?'entry':'entries'}. Remove all of them as well?</p><p class="hint">No keeps the log and marks the issue unread. Ratings are preserved.</p><div class="actions"><button type="button" data-answer="yes">Yes, remove entries</button><button type="button" class="quiet" data-answer="no" autofocus>No, keep entries</button><button type="button" class="quiet" data-cancel>Cancel</button></div>`
      : `<h2 id="read-dialog-title">${logOnly?'Add Reading Log Entry':'Mark As Read'}</h2><form id="read-log-form">${logOnly?'':'<label class="record-log-switch"><input type="checkbox" role="switch" id="record-reading">Record in Reading Log</label>'}<label class="log-date-label">Reading date<input type="date" name="log_date" value="${localToday()}" required ${logOnly?'':'disabled'}></label><div class="actions"><button type="submit">OK</button><button type="button" class="quiet" data-cancel>Cancel</button></div></form>`;
    dialog.addEventListener('close',()=>resolve(result),{once:true});
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    if(unread)dialog.querySelectorAll('[data-answer]').forEach(button=>button.onclick=()=>{result={remove_log_entries:button.dataset.answer==='yes'};dialog.close();});
    else{
      const form=dialog.querySelector('form'),toggle=dialog.querySelector('#record-reading'),date=form.querySelector('[name=log_date]');
      if(toggle)toggle.onchange=()=>{date.disabled=!toggle.checked;};
      form.onsubmit=event=>{event.preventDefault();result={};if(logOnly||toggle.checked)result.log_date=date.value;dialog.close();};
    }
    dialog.showModal();
  });
}
export async function changeRead(ctx,state,{logOnly=false}={}) {
  if(ctx.busy||!state.editionKey)return;
  ctx.busy=true;ctx.notify();
  try{
    if(!logOnly&&ctx.issue.read){
      // Refresh counts so the confirmation includes entries added elsewhere.
      ctx.sync(await ctx.api(`/issues/${ctx.issue.id}`));
      const count=ctx.issue.reading_log_count||0;
      const choice=count?await readPrompt({unread:true,count}):{};
      if(choice===null)return;
      ctx.sync(await ctx.api(`/issues/${ctx.issue.id}/read`,{method:'PATCH',body:JSON.stringify({read:false,...choice})}));
    }else{
      const choice=await readPrompt({logOnly});if(choice===null)return;
      if(ctx.saved)ctx.sync(await ctx.api(`/issues/${ctx.issue.id}/read`,{method:'PATCH',body:JSON.stringify({read:true,edition_key:state.editionKey,...choice})}));
      else ctx.sync((await ctx.api('/entries',{method:'POST',body:JSON.stringify({issue_id:ctx.issue.id,edition_key:state.editionKey,owned:false,read:true,...choice})})).issue);
    }
  }catch(error){ctx.onError(error.message);}
  finally{ctx.busy=false;ctx.notify();}
}

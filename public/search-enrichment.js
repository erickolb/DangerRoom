// One optional request at a time. No retry timer or work survives the current results page.
export async function enrichSearchSeries(rows,{request,current,onUpdate=()=>{},onState=()=>{}}) {
  const ids=[...new Set(rows.filter(row=>row.series_type_pending).map(row=>row.series.id))];
  if(!current())return;
  onState(ids.length?'loading':'complete');
  for(const id of ids){
    if(!current())return;
    let result;
    try{
      result=await request(`/metron/series/${id}/type`);
      if(result.series_id!==id)throw Error('Unexpected series metadata.');
    }catch{
      if(current())onState('stopped');
      return;
    }
    if(!current())return;
    for(const row of rows)if(row.series.id===id){row.series.series_type=result.series_type;row.series_type_pending=false;}
    onUpdate();
    if(result.quota_exhausted && rows.some(row=>row.series_type_pending)){onState('stopped');return;}
  }
  if(current())onState('complete');
}

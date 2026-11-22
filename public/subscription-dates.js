const iso=date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
export function subscriptionWeek(today){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('Invalid date.');
  const day=new Date(`${today}T12:00:00Z`);
  if(!Number.isFinite(day.getTime())||iso(day)!==today)throw Error('Invalid date.');
  day.setUTCDate(day.getUTCDate()-day.getUTCDay());const start=iso(day);
  day.setUTCDate(day.getUTCDate()+6);return {start,end:iso(day)};
}
export function subscriptionIssues(rows,view,today){
  const {start,end}=subscriptionWeek(today);
  return rows.filter(row=>row.store_date && (view==='week'?row.store_date>=start&&row.store_date<=end:
    view==='upcoming'?row.store_date>end:row.store_date<start&&!row.owned))
    .sort((a,b)=>a.store_date.localeCompare(b.store_date)||a.series.name.localeCompare(b.series.name)||Number(a.id)-Number(b.id));
}
export function subscriptionThumbnail(rows,today){
  const dated=rows.filter(row=>row.store_date).sort((a,b)=>a.store_date.localeCompare(b.store_date)||Number(a.id)-Number(b.id));
  return dated.find(row=>row.store_date>=today)||dated.at(-1)||null;
}

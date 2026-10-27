const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formatBadge(type){
  const name=(typeof type==='string'?type:type?.name||'').trim().toLowerCase();
  if(name==='trade paperback'||name==='tpb')return {asset:'tpb',label:'Trade Paperback'};
  if(name==='hardcover'||name==='hard cover'||name==='hc')return {asset:'hc',label:'Hardcover'};
  if(name==='omnibus'||name==='omni')return {asset:'omni',label:'Omnibus'};
  return null;
}
export function comicTitle(issue,{year=false}={}){
  const series=issue.series||{},badge=formatBadge(series.series_type);
  const title=escape(series.name||issue.display_name||'Comic');
  const suffix=year&&series.year_began ? ` (${escape(series.year_began)})` : '';
  const image=badge?` <img class="format-badge" src="/format-${badge.asset}.png" alt="${badge.label}">`:'';
  return `${title}${suffix}${image}${badge?.asset==='omni'?'':` <span class="comic-number">#${escape(issue.number)}</span>`}`;
}
export function comicTitleText(issue,{year=false}={}){
  const series=issue.series||{},badge=formatBadge(series.series_type);
  return `${series.name||issue.display_name||'Comic'}${year&&series.year_began?` (${series.year_began})`:''}${badge?` ${badge.label}`:''}${badge?.asset==='omni'?'':` #${issue.number}`}`;
}

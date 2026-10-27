export function selectedSeriesTypes(params){
  return new Set((params.get('series_types')||'').split(',').filter(value=>/^\d+$/.test(value)).map(Number).filter(Number.isSafeInteger));
}
export function filterSearchResults(rows,{hideOwned=false,seriesTypes=new Set()}={}){
  return rows.filter(row=>(!hideOwned||!row.owned)&&(!seriesTypes.size||seriesTypes.has(row.series.series_type?.id||0)));
}
export function seriesTypeOptions(rows,catalog=[],selected=new Set()){
  const types=new Map(catalog.map(type=>[type.id,type.name]));
  for(const row of rows)if(row.series.series_type)types.set(row.series.series_type.id,row.series.series_type.name);
  types.set(0,'Not supplied');for(const id of selected)if(!types.has(id))types.set(id,`Series type ${id}`);
  return [...types].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
}

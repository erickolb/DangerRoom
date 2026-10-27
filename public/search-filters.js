export function selectedSeriesTypes(params){
  return new Set((params.get('series_types')||'').split(',').filter(value=>/^\d+$/.test(value)).map(Number).filter(Number.isSafeInteger));
}
export function filterSearchResults(rows,{hideOwned=false,seriesTypes=new Set(),seriesNames=new Set()}={}){
  return rows.filter(row=>(!hideOwned||!row.owned)&&(!seriesNames.size||seriesNames.has(row.series.name))&&(!seriesTypes.size||seriesTypes.has(row.series.series_type?.id||0)));
}
export function seriesTypeOptions(rows,catalog=[],selected=new Set()){
  const types=new Map(catalog.map(type=>[type.id,type.name]));
  for(const row of rows)if(row.series.series_type)types.set(row.series.series_type.id,row.series.series_type.name);
  types.set(0,'Not supplied');for(const id of selected)if(!types.has(id))types.set(id,`Series type ${id}`);
  return [...types].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
}

export function selectedSeriesNames(params){return new Set(params.getAll('series_name_filter'));}
export function seriesNameOptions(rows,selected=new Set()){return [...new Set([...rows.map(row=>row.series.name),...selected])].sort((a,b)=>a.localeCompare(b));}

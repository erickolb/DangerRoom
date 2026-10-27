// A rating owns its +/- half-issue band. Gaps use the next known rating.
export function ratingSegments(points, end) {
  const sorted=[...points].sort((a,b)=>a.number-b.number), segments=[];
  let cursor=0;
  for(const point of sorted){
    const left=Math.max(cursor,point.number-0.5),right=Math.min(end,point.number+0.5);
    if(left>cursor)segments.push({from:cursor,to:left,rating:point.rating,solid:false});
    if(right>left)segments.push({from:left,to:right,rating:point.rating,solid:true});
    cursor=right;
  }
  if(sorted.length&&cursor<end)segments.push({from:cursor,to:end,rating:sorted.at(-1).rating,solid:false});
  return segments;
}
export function seriesRatingChart(data){
  if(data.points.length<2)return '';
  const end=Math.max(data.max_issue,...data.points.map(p=>p.number))+0.5;
  const width=900,height=340,left=52,right=20,top=20,bottom=46;
  const x=n=>left+n/end*(width-left-right),y=n=>top+(5-n)/5*(height-top-bottom);
  const segments=ratingSegments(data.points,end);
  let marks='';
  for(let half=0;half<=10;half++){
    const score=half/2;
    marks+=`<line class="rating-grid" x1="${left}" x2="${width-right}" y1="${y(score)}" y2="${y(score)}"/><text x="${left-10}" y="${y(score)+4}" text-anchor="end">${score.toFixed(1)}</text>`;
  }
  const step=Math.max(1,Math.ceil(data.max_issue/25));
  const ticks=new Set([1,data.max_issue]);for(let n=step;n<data.max_issue;n+=step)ticks.add(n);
  for(const n of [...ticks].sort((a,b)=>a-b))marks+=`<text x="${x(n)}" y="${height-24}" text-anchor="middle">${n}</text>`;
  segments.forEach((segment,i)=>{
    const previous=segments[i-1];
    if(previous&&previous.rating!==segment.rating)marks+=`<line class="rating-line inferred" x1="${x(segment.from)}" x2="${x(segment.from)}" y1="${y(previous.rating)}" y2="${y(segment.rating)}"/>`;
    marks+=`<line class="rating-line ${segment.solid?'recorded':'inferred'}" x1="${x(segment.from)}" x2="${x(segment.to)}" y1="${y(segment.rating)}" y2="${y(segment.rating)}"/>`;
  });
  for(const point of data.points)marks+=`<circle class="rating-dot" cx="${x(point.number)}" cy="${y(point.rating)}" r="5"><title>Issue #${point.number}: ${point.rating} / 5</title></circle>`;
  const description=data.points.map(p=>`Issue ${p.number}: ${p.rating} out of 5`).join('; ');
  return `<svg class="series-rating-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Series ratings, from issue 1 to ${data.max_issue}. ${description}"><text x="${width/2}" y="${height-4}" text-anchor="middle">Issue number</text>${marks}</svg><p class="hint rating-note">Dots are recorded ratings. Solid lines mark rated issues; dotted lines bridge unrated issues. Range uses locally saved issues in this series run.</p>`;
}

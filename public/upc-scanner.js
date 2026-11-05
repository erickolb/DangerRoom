export const validUPC = value => /^\d{1,18}$/.test(value);
export function matchingEdition(editions, upc) {
  if (!validUPC(upc || '')) return null;
  const matches = editions.filter(edition => edition.upc?.trim() === upc);
  return matches.length === 1 ? matches[0].key : null;
}
export function isScanPrefix(event) {
  return event.key === '\u0002' || (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'b');
}
// Prefix-driven framing; typing speed is deliberately not used to identify a scan.
export function createUPCScanner({onStart, onScan, onError, schedule=setTimeout, unschedule=clearTimeout}) {
  let active=false, buffer='', invalid=false, timer, swallowEnterUp=false;
  function reset() {active=false;buffer='';invalid=false;unschedule(timer);}
  function arm() {unschedule(timer);timer=schedule(()=>{reset();onError('Incomplete barcode discarded. Scan again.');},2000);}
  return {
    get active(){return active;},
    reset,
    handle(event) {
      if(event.type==='keyup') {
        if(event.key==='Enter' && swallowEnterUp){swallowEnterUp=false;return true;}
        return active;
      }
      if(isScanPrefix(event)) {reset();active=true;onStart();arm();return true;}
      if(!active)return false;
      if(event.key==='Enter') {
        const value=buffer, rejected=invalid || !validUPC(value);
        reset();swallowEnterUp=true;
        if(rejected)onError('Scan must contain 1–18 digits. Nothing was searched.');else onScan(value);
      } else if(event.key==='Escape')reset();
      else if(!['Control','Shift','Alt','Meta'].includes(event.key)) {
        if(event.key.length===1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if(buffer.length<19)buffer+=event.key;
          if(!/^\d$/.test(event.key) || buffer.length>18)invalid=true;
        } else invalid=true;
        arm();
      }
      return true;
    }
  };
}

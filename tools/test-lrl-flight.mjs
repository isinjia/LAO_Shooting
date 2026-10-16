import assert from 'node:assert/strict';
import { lrlFlightLayers } from '../js/native-weapon-fx.js';
let min=15,max=0;
for(let i=1;i<=240;i++){
 const layers=lrlFlightLayers(i/120);
 assert(layers.length>0&&layers.length<=3,'Bounded overlapping playback');
 assert(layers.some(l=>l.frame>=2&&l.frame<12&&l.alpha>.5)||i<10,'A visible animated blade remains during flight');
 for(const l of layers){min=Math.min(min,l.frame);max=Math.max(max,l.frame);}
 assert(layers.every(l=>Math.abs(l.rotation + Math.PI / 2) <= .181),
   'The slash should keep its cutting direction instead of tumbling through a full turn');
}
assert(min<1&&max>14,'Flight plays through the full source animation, not just its first few cells');
const a=lrlFlightLayers(.399999),b=lrlFlightLayers(.4);
assert(a.some(x=>b.some(y=>Math.abs(y.frame-x.frame)<.001)),'A new wave does not reset existing animation');
console.log('LRL flight: full animation range, overlap continuity, readable active blade, bounded layers passed');

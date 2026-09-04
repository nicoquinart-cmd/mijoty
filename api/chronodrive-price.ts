// Mijoty V1.10 — recherche Chronodrive sans API payante.
// Stratégie : recherche web publique (DuckDuckGo HTML), puis lecture directe
// des pages produit Chronodrive trouvées. Aucun service IA/API payant.

type Req = { query?: Record<string, string | string[] | undefined> };
type Res = { status: (n:number)=>Res; json:(v:any)=>void };

const UA = 'Mozilla/5.0 (compatible; Mijoty/1.10; +https://mijoty.vercel.app/)';
const clean = (s:string) => s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const norm = (s:string) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens = (s:string) => norm(s).split(' ').filter(x=>x.length>2);

function scorePage(text:string, name:string, quantity?:string, unit?:string, barcode?:string) {
  const n = norm(text); const wanted=tokens(name); let score=0;
  for (const t of wanted) if (n.includes(t)) score += 1;
  if (wanted.length) score /= wanted.length;
  if (barcode && text.includes(barcode)) score += 1.2;
  if (quantity && unit) {
    const q = `${quantity} ${unit}`.replace('.',',').toLowerCase();
    if (text.toLowerCase().includes(q) || text.toLowerCase().includes(q.replace(' ',''))) score += .35;
  }
  return score;
}

function parseProduct(html:string, url:string) {
  const text=clean(html);
  const title=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s*\|[\s\S]*$/,'');
  const packageText=text.match(/Poids ou quantité\s*:\s*([^€]{1,45}?)(?=Prix au kg|Prix au litre|Prix au kg ou au litre)/i)?.[1]?.trim() || null;
  const ppu=text.match(/Prix au kg ou au litre\s*:\s*([0-9]+[,.][0-9]{2}\s*€\s*\/\s*[^\s]+)/i)?.[1]?.replace(',','.') || null;
  // On cherche un prix proche de la zone produit, et on privilégie le dernier prix en cas de promotion.
  const zone=text.slice(0, Math.min(text.length, 4500));
  const prices=[...zone.matchAll(/(?:Nouveau prix\s*:\s*)?([0-9]+[,.][0-9]{2})\s*€/gi)].map(m=>Number(m[1].replace(',','.'))).filter(x=>x>0 && x<1000);
  const price=prices.length ? prices[prices.length-1] : null;
  const eans=text.match(/Référence\s*\/\s*EAN\(S\)\s*:\s*[^/]*\/\s*([0-9 ]+)/i)?.[1]?.trim() || null;
  return { productName: clean(title), packageText, pricePerUnit: ppu, price, eans, url };
}

export default async function handler(req:Req,res:Res) {
  try {
    const q=req.query || {}; const name=String(q.name||'').trim();
    const quantity=q.quantity ? String(q.quantity) : ''; const unit=q.unit ? String(q.unit) : ''; const barcode=q.barcode ? String(q.barcode) : '';
    if (!name && !barcode) return res.status(400).json({error:'Produit manquant'});
    const searchTerms=[barcode, name, quantity && unit ? `${quantity} ${unit}` : ''].filter(Boolean).join(' ');
    const ddg=`https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:chronodrive.com '+searchTerms)}`;
    const sr=await fetch(ddg,{headers:{'user-agent':UA,'accept-language':'fr-FR,fr;q=0.9'}});
    if (!sr.ok) return res.status(200).json({found:false,note:'Recherche Chronodrive temporairement indisponible'});
    const sh=await sr.text();
    const links:string[]=[];
    for (const m of sh.matchAll(/href="([^"]+)"/g)) {
      let u=m[1].replace(/&amp;/g,'&');
      const uddg=u.match(/[?&]uddg=([^&]+)/)?.[1]; if (uddg) u=decodeURIComponent(uddg);
      if (/^https:\/\/www\.chronodrive\.com\/.+-P\d+/i.test(u) && !links.includes(u)) links.push(u);
      if (links.length>=5) break;
    }
    let best:any=null; let bestScore=0;
    for (const url of links) {
      try {
        const r=await fetch(url,{headers:{'user-agent':UA,'accept-language':'fr-FR,fr;q=0.9'}}); if(!r.ok) continue;
        const html=await r.text(); const product=parseProduct(html,url); if(product.price==null) continue;
        const s=scorePage(clean(html).slice(0,10000),name,quantity,unit,barcode);
        if(s>bestScore){bestScore=s;best=product;}
      } catch {}
    }
    if(!best || bestScore<0.55) return res.status(200).json({found:false,checkedAt:new Date().toISOString(),note:'Aucune correspondance Chronodrive suffisamment fiable'});
    return res.status(200).json({found:true,productName:best.productName,packageText:best.packageText,price:best.price,pricePerUnit:best.pricePerUnit,url:best.url,confidence:Math.min(1,bestScore/1.5),checkedAt:new Date().toISOString(),note:'Prix lu sur la page produit Chronodrive'});
  } catch(e){ console.error(e); return res.status(200).json({found:false,checkedAt:new Date().toISOString(),note:'Prix Chronodrive non vérifié'}); }
}

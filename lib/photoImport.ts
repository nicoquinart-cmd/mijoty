export type DetectedStockItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  barcode?: string;
  price?: number;
  confidence?: number;
  brand?: string;
  category?: string;
  imageUrl?: string;
  source?: string;
};

export type ReceiptMeta = { storeName: string; date: string; total: number | null };

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
const stopWords = new Set(['TOTAL','SOUS TOTAL','TOTAL EUR','CARTE','CB','VISA','MASTERCARD','TVA','TTC','HT','RENDUE','MONNAIE','MERCI','BONJOUR','CAISSE','TICKET','RECU','DATE','HEURE','CLIENT','FIDELITE','SIRET','SIREN','MAGASIN','ARTICLE','PRIX','EUR','EURO','EUROS','A PAYER','PAIEMENT','BANQUE','AUTORISATION','TRANSACTION','SOLDE','REMBOURSEMENT','PROMOTION','REMISE','ECONOMIE','ECONOMIES']);
function cleanText(s:string){return s.replace(/[|•*_]/g,' ').replace(/\s+/g,' ').trim()}
function looksLikeNoise(line:string){const u=line.toUpperCase();if(line.length<3||stopWords.has(u)||[...stopWords].some(w=>u.startsWith(w)))return true;if(/^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{2}:\d{2})/.test(line))return true;if(/^[\d\s.,€%+\-:]+$/.test(line))return true;if(/^(TEL|WWW|HTTP|RUE|AVENUE|ROUTE|CENTRE|ZI|ZAC|SAS|SARL|SASU|FR\s?\d+)/i.test(line))return true;return false}
function priceAtEnd(line:string){const m=line.match(/([0-9]{1,4}[,.][0-9]{2})\s*€?\s*$/);return m?Number(m[1].replace(',','.')):undefined}
function stripPriceAndCodes(line:string){return cleanText(line).replace(/\s+[-+]?[0-9]+[,.][0-9]{2}\s*€?\s*$/i,'').replace(/\s+[0-9]{8,14}\s*$/i,'').replace(/^\d+\s*[xX]\s+/,'').trim()}
function inferQuantity(raw:string){const m=raw.match(/\b(\d+(?:[,.]\d+)?)\s*(KG|G|L|ML|CL)\b/i);if(!m)return {quantity:'1',unit:'unité'};return {quantity:m[1].replace(',','.'),unit:m[2].toLowerCase()}}

export function parseReceiptText(text:string):DetectedStockItem[]{const lines=text.split(/\r?\n/).map(cleanText).filter(Boolean);const out:DetectedStockItem[]=[];const seen=new Set<string>();for(const raw of lines){if(looksLikeNoise(raw)||!/[A-Za-zÀ-ÿ]{3,}/.test(raw))continue;const price=priceAtEnd(raw);let name=stripPriceAndCodes(raw);const q=inferQuantity(name);name=name.replace(/\b\d+[,.]?\d*\s*(KG|G|L|ML|CL)\b/ig,'').trim();if(name.length<3||name.length>70)continue;const n=name.toUpperCase();if(stopWords.has(n)||seen.has(n))continue;if(!price&&name.split(' ').length>7)continue;seen.add(n);out.push({id:id(),name,quantity:q.quantity,unit:q.unit,price,confidence:price?0.88:0.6});if(out.length>=35)break}return out}

export function extractReceiptMeta(text:string):ReceiptMeta{const lines=text.split(/\r?\n/).map(cleanText).filter(Boolean);let date='';for(const l of lines){const m=l.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);if(m){const y=m[3].length===2?`20${m[3]}`:m[3];date=`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;break}}
let total:null|number=null;for(const l of [...lines].reverse()){if(/\b(total|a payer|à payer|net a payer|net à payer)\b/i.test(l)){const nums=[...l.matchAll(/(\d{1,5}[,.]\d{2})/g)];if(nums.length){total=Number(nums[nums.length-1][1].replace(',','.'));break}}}
const store=lines.find(l=>/[A-Za-zÀ-ÿ]{3,}/.test(l)&&!looksLikeNoise(l)&&l.length<45)||'';return {storeName:store,date,total}}

export function bestProductNameFromText(text:string):string{const scored=text.split(/\r?\n/).map(cleanText).filter(Boolean).filter(l=>!looksLikeNoise(l)&&/[A-Za-zÀ-ÿ]{3,}/.test(l)).map(l=>{const c=stripPriceAndCodes(l).slice(0,70);const letters=(c.match(/[A-Za-zÀ-ÿ]/g)||[]).length;return {c,score:letters+(c===c.toUpperCase()?4:0)-Math.max(0,c.split(' ').length-5)*3}}).filter(x=>x.c.length>=3).sort((a,b)=>b.score-a.score);return scored[0]?.c||'Produit détecté'}
export async function runOcr(uri:string,onProgress?:(p:number)=>void){const Tesseract=await import('tesseract.js');const r=await Tesseract.recognize(uri,'fra',{logger:m=>{if(m.status==='recognizing text'&&typeof m.progress==='number')onProgress?.(m.progress)}});return r.data.text||''}
export async function detectBarcode(uri:string):Promise<string|null>{try{const {BrowserMultiFormatReader}=await import('@zxing/browser');const reader=new BrowserMultiFormatReader();const r=await reader.decodeFromImageUrl(uri);return r?.getText?.()||null}catch{return null}}
export async function lookupBarcode(barcode:string){
  const code=barcode.replace(/\D/g,'');
  if(!code)return null;
  const fields='product_name,brands,quantity,categories_tags,image_front_url';
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?fields=${fields}`);
    if(r.ok){
      const j=await r.json();
      const p=j?.product;
      if(p?.product_name){
        const q=inferQuantity(p.quantity||'');
        return {name:p.product_name||'',brand:p.brands||'',quantity:q.quantity,unit:q.unit,category:Array.isArray(p.categories_tags)?String(p.categories_tags[0]||'').replace(/^..:/,''):'',imageUrl:p.image_front_url||'',source:'Open Food Facts'};
      }
    }
  }catch{}
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,categories_tags,image_front_url`);
    if(!r.ok)return null;
    const j=await r.json();if(j.status!==1||!j.product)return null;const p=j.product;const q=inferQuantity(p.quantity||'');
    return {name:p.product_name||'',brand:p.brands||'',quantity:q.quantity,unit:q.unit,category:Array.isArray(p.categories_tags)?String(p.categories_tags[0]||'').replace(/^..:/,''):'',imageUrl:p.image_front_url||'',source:'Open Food Facts'};
  }catch{return null}
}

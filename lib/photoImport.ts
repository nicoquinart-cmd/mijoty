export type DetectedStockItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  barcode?: string;
  confidence?: number;
};

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const stopWords = new Set([
  'TOTAL','SOUS TOTAL','TOTAL EUR','CARTE','CB','VISA','MASTERCARD','TVA','TTC','HT','RENDUE','MONNAIE','MERCI','BONJOUR','CAISSE','TICKET','RECU','DATE','HEURE','CLIENT','FIDELITE','SIRET','SIREN','MAGASIN','ARTICLE','PRIX','EUR','EURO','EUROS','A PAYER','PAIEMENT','BANQUE','AUTORISATION','TRANSACTION','SOLDE','REMBOURSEMENT','PROMOTION','REMISE','ECONOMIE','ECONOMIES'
]);

function cleanText(s: string) {
  return s.replace(/[|•*_]/g, ' ').replace(/\s+/g, ' ').trim();
}

function looksLikeNoise(line: string) {
  const upper = line.toUpperCase();
  if (line.length < 3) return true;
  if (stopWords.has(upper)) return true;
  if ([...stopWords].some(w => upper.startsWith(w))) return true;
  if (/^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{2}:\d{2})/.test(line)) return true;
  if (/^[\d\s.,€%+\-:]+$/.test(line)) return true;
  if (/^(TEL|WWW|HTTP|RUE|AVENUE|ROUTE|CENTRE|ZI|ZAC|SAS|SARL|SASU|FR\s?\d+)/i.test(line)) return true;
  return false;
}

function stripPriceAndCodes(line: string) {
  return cleanText(line)
    .replace(/\s+[-+]?[0-9]+[,.][0-9]{2}\s*€?\s*$/i, '')
    .replace(/\s+[0-9]{8,14}\s*$/i, '')
    .replace(/^\d+\s*[xX]\s+/, '')
    .trim();
}

export function parseReceiptText(text: string): DetectedStockItem[] {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  const candidates: DetectedStockItem[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    if (looksLikeNoise(raw)) continue;
    const hasPrice = /\d+[,.]\d{2}\s*€?\s*$/.test(raw);
    const hasLetters = /[A-Za-zÀ-ÿ]{3,}/.test(raw);
    if (!hasLetters) continue;

    let name = stripPriceAndCodes(raw);
    name = name.replace(/\b\d+[,.]?\d*\s*(KG|G|L|ML|CL)\b/ig, '').trim();
    if (name.length < 3 || name.length > 70) continue;

    const normalized = name.toUpperCase();
    if (stopWords.has(normalized) || seen.has(normalized)) continue;

    // Receipt OCR is imperfect. Prefer lines that look like a product line,
    // but keep plausible textual lines when no price was recognized.
    const wordCount = name.split(' ').length;
    if (!hasPrice && (wordCount > 7 || wordCount < 1)) continue;

    seen.add(normalized);
    candidates.push({ id: id(), name, quantity: '1', unit: 'unité', confidence: hasPrice ? 0.85 : 0.6 });
    if (candidates.length >= 25) break;
  }
  return candidates;
}

export function bestProductNameFromText(text: string): string {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  const scored = lines
    .filter(line => !looksLikeNoise(line) && /[A-Za-zÀ-ÿ]{3,}/.test(line))
    .map(line => {
      const cleaned = stripPriceAndCodes(line).slice(0, 70);
      const letters = (cleaned.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      const words = cleaned.split(' ').filter(Boolean).length;
      const allCapsBonus = cleaned === cleaned.toUpperCase() ? 4 : 0;
      const score = letters + allCapsBonus - Math.max(0, words - 5) * 3;
      return { cleaned, score };
    })
    .filter(x => x.cleaned.length >= 3)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.cleaned || 'Produit détecté';
}

export async function runOcr(uri: string, onProgress?: (p: number) => void) {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(uri, 'fra', {
    logger: m => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress?.(m.progress);
    },
  });
  return result.data.text || '';
}

export async function detectBarcode(uri: string): Promise<string | null> {
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(uri);
    return result?.getText?.() || null;
  } catch {
    return null;
  }
}

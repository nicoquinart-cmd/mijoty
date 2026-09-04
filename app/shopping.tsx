import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal, Field, ModalButton } from '@/components/Forms';
import { AppHeader, Card, EmptyState, PrimaryButton } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { isoDate } from '@/lib/date';
import { findChronodrivePrice } from '@/lib/chronodrive';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Item = {
  id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  estimated_price: number | null;
  checked: boolean;
  proposal_status: 'pending' | 'accepted' | 'rejected';
  source_key: string | null;
  source_label: string | null;
  retailer_name: string | null;
  retailer_product_name: string | null;
  retailer_package: string | null;
  retailer_price: number | null;
  retailer_price_per_unit: string | null;
  retailer_url: string | null;
  retailer_confidence: number | null;
  retailer_checked_at: string | null;
};

type Need = {
  key: string;
  itemName: string;
  unit: string | null;
  baseUnit: string;
  displayFactor: number;
  quantity: number;
  recipeNames: Set<string>;
};

const normalize = (value?: string | null) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const unitInfo = (value?: string | null) => {
  const x = normalize(value);
  const aliases: Record<string, { base: string; factor: number }> = {
    g: { base: 'g', factor: 1 }, gr: { base: 'g', factor: 1 }, gramme: { base: 'g', factor: 1 }, grammes: { base: 'g', factor: 1 },
    kg: { base: 'g', factor: 1000 }, kgs: { base: 'g', factor: 1000 }, kilogramme: { base: 'g', factor: 1000 }, kilogrammes: { base: 'g', factor: 1000 },
    ml: { base: 'ml', factor: 1 }, millilitre: { base: 'ml', factor: 1 }, millilitres: { base: 'ml', factor: 1 },
    l: { base: 'ml', factor: 1000 }, litre: { base: 'ml', factor: 1000 }, litres: { base: 'ml', factor: 1000 },
    piece: { base: 'unite', factor: 1 }, pieces: { base: 'unite', factor: 1 }, unite: { base: 'unite', factor: 1 }, unites: { base: 'unite', factor: 1 },
  };
  return aliases[x] || { base: x || 'unite', factor: 1 };
};

const asNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export default function Shopping() {
  const { householdId } = useApp();
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [priceChecking, setPriceChecking] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');

  const ensureList = useCallback(async () => {
    if (!householdId) return null;
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;

    const { data: created, error: createError } = await supabase
      .from('shopping_lists')
      .insert({ household_id: householdId, name: 'Courses de la semaine', status: 'open' })
      .select('id')
      .single();
    if (createError) throw createError;
    return created.id as string;
  }, [householdId]);

  const fetchItems = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('id,item_name,quantity,unit,estimated_price,checked,proposal_status,source_key,source_label,retailer_name,retailer_product_name,retailer_package,retailer_price,retailer_price_per_unit,retailer_url,retailer_confidence,retailer_checked_at')
      .eq('shopping_list_id', id)
      .order('checked', { ascending: true });
    if (error) throw error;
    const rows = (data || []).map((x: any) => ({
      ...x,
      proposal_status: x.proposal_status || 'accepted',
    })) as Item[];
    setItems(rows);
    return rows;
  }, []);

  const syncRecipeSuggestions = useCallback(async (id: string, currentItems?: Item[]) => {
    if (!householdId) return;
    setSyncing(true);
    try {
      const today = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);

      const { data: plans, error: planError } = await supabase
        .from('meal_plans')
        .select(`
          id, meal_date, portions,
          recipes(
            id, title, default_portions,
            recipe_ingredients(id, product_id, ingredient_name, quantity, unit)
          )
        `)
        .eq('household_id', householdId)
        .gte('meal_date', isoDate(today))
        .lte('meal_date', isoDate(end));
      if (planError) throw planError;

      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('id,product_id,custom_name,quantity,unit,products(name)')
        .eq('household_id', householdId);
      if (inventoryError) throw inventoryError;

      const needs = new Map<string, Need>();
      for (const rawPlan of (plans || []) as any[]) {
        const recipe: any = Array.isArray(rawPlan.recipes) ? rawPlan.recipes[0] : rawPlan.recipes;
        if (!recipe) continue;
        const scale = asNumber(rawPlan.portions, asNumber(recipe.default_portions, 4)) / Math.max(1, asNumber(recipe.default_portions, 4));
        for (const ingredient of (recipe.recipe_ingredients || [])) {
          const ingredientName = String(ingredient.ingredient_name || '').trim();
          if (!ingredientName) continue;
          const info = unitInfo(ingredient.unit);
          const identity = ingredient.product_id ? `p:${ingredient.product_id}` : `n:${normalize(ingredientName)}`;
          const key = `${identity}|u:${info.base}`;
          const rawQuantity = ingredient.quantity == null ? 1 : Math.max(0, asNumber(ingredient.quantity) * scale);
          const quantity = rawQuantity * info.factor;
          const existing = needs.get(key);
          if (existing) {
            existing.quantity += quantity;
            existing.recipeNames.add(recipe.title);
          } else {
            needs.set(key, {
              key,
              itemName: ingredientName,
              unit: ingredient.unit || null,
              baseUnit: info.base,
              displayFactor: info.factor,
              quantity,
              recipeNames: new Set([recipe.title]),
            });
          }
        }
      }

      const stock = new Map<string, number>();
      for (const row of (inventory || []) as any[]) {
        const product: any = Array.isArray(row.products) ? row.products[0] : row.products;
        const itemName = row.custom_name || product?.name || '';
        const info = unitInfo(row.unit);
        const amount = asNumber(row.quantity) * info.factor;
        const identities = new Set<string>();
        if (row.product_id) identities.add(`p:${row.product_id}`);
        if (itemName) identities.add(`n:${normalize(itemName)}`);
        for (const identity of identities) {
          const key = `${identity}|u:${info.base}`;
          stock.set(key, (stock.get(key) || 0) + amount);
        }
      }

      const existing = currentItems || await fetchItems(id);
      const alreadyAccepted = new Map<string, number>();
      for (const item of existing) {
        if (item.proposal_status !== 'accepted' || item.checked) continue;
        const info = unitInfo(item.unit);
        const key = `n:${normalize(item.item_name)}|u:${info.base}`;
        alreadyAccepted.set(key, (alreadyAccepted.get(key) || 0) + asNumber(item.quantity) * info.factor);
      }

      const activeSourceKeys = new Set<string>();
      for (const need of needs.values()) {
        const sourceKey = `recipe-need:${need.key}`;
        activeSourceKeys.add(sourceKey);
        const available = stock.get(need.key) || 0;
        const acceptedByName = alreadyAccepted.get(`n:${normalize(need.itemName)}|u:${need.baseUnit}`) || 0;
        const missing = Math.max(0, need.quantity - available - acceptedByName);
        const prior = existing.find(x => x.source_key === sourceKey);

        if (missing <= 0.0001) {
          if (prior?.proposal_status === 'pending') {
            await supabase.from('shopping_list_items').delete().eq('id', prior.id);
          }
          continue;
        }

        if (prior?.proposal_status === 'accepted' || prior?.proposal_status === 'rejected') continue;

        const payload = {
          shopping_list_id: id,
          item_name: need.itemName,
          quantity: Number((missing / Math.max(need.displayFactor, 1)).toFixed(2)),
          unit: need.unit,
          estimated_price: null,
          checked: false,
          proposal_status: 'pending',
          source_key: sourceKey,
          source_label: `Manquant pour : ${Array.from(need.recipeNames).join(', ')}`,
        };

        if (prior) {
          const { error } = await supabase.from('shopping_list_items').update(payload).eq('id', prior.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('shopping_list_items').insert(payload);
          if (error) throw error;
        }
      }

      const obsoletePending = existing.filter(x => x.proposal_status === 'pending' && x.source_key?.startsWith('recipe-need:') && !activeSourceKeys.has(x.source_key));
      if (obsoletePending.length) {
        const { error } = await supabase.from('shopping_list_items').delete().in('id', obsoletePending.map(x => x.id));
        if (error) throw error;
      }

      await fetchItems(id);
    } finally {
      setSyncing(false);
    }
  }, [fetchItems, householdId]);

  const load = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const id = await ensureList();
      setListId(id);
      if (id) {
        const rows = await fetchItems(id);
        await syncRecipeSuggestions(id, rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [householdId, ensureList, fetchItems, syncRecipeSuggestions]);

  useEffect(() => { load(); }, [load]);

  async function lookupPrice(itemName: string, quantityValue: number, unitValue?: string | null) {
    try {
      return await findChronodrivePrice({ name: itemName, quantity: quantityValue, unit: unitValue || null });
    } catch (e: any) {
      console.error(e);
      return { found: false, note: e?.message || 'Prix Chronodrive non trouvé' };
    }
  }

  async function add() {
    if (!listId || !name.trim()) return;
    const quantityValue = Number(qty) || 1;
    setPriceChecking(true);
    setPriceMessage('Recherche du prix chez Chronodrive…');
    const match = await lookupPrice(name.trim(), quantityValue, unit || null);
    const chronodrivePrice = match.found && match.price != null ? Number(match.price) : null;
    const effectivePrice = chronodrivePrice ?? (price ? Number(price) : null);

    const { error } = await supabase.from('shopping_list_items').insert({
      shopping_list_id: listId,
      item_name: name.trim(),
      quantity: quantityValue,
      unit: unit || null,
      estimated_price: effectivePrice,
      checked: false,
      proposal_status: 'accepted',
      retailer_name: match.found ? 'Chronodrive' : null,
      retailer_product_name: match.found ? match.productName || name.trim() : null,
      retailer_package: match.found ? match.packageText || null : null,
      retailer_price: chronodrivePrice,
      retailer_price_per_unit: match.found ? match.pricePerUnit || null : null,
      retailer_url: match.found ? match.url || null : null,
      retailer_confidence: match.found ? match.confidence ?? null : null,
      retailer_checked_at: match.found ? match.checkedAt || new Date().toISOString() : null,
    });
    setPriceChecking(false);
    if (error) alert(error.message);
    else {
      setPriceMessage(match.found ? `Trouvé chez Chronodrive : ${chronodrivePrice?.toFixed(2)} €` : 'Prix Chronodrive non trouvé — article ajouté sans prix vérifié.');
      setName(''); setQty('1'); setUnit(''); setPrice(''); setModal(false);
      await fetchItems(listId);
    }
  }

  async function toggle(item: Item) {
    if (item.proposal_status !== 'accepted') return;
    const { error } = await supabase.from('shopping_list_items').update({ checked: !item.checked }).eq('id', item.id);
    if (error) alert(error.message);
    else setItems(v => v.map(x => x.id === item.id ? { ...x, checked: !x.checked } : x));
  }

  async function decide(item: Item, status: 'accepted' | 'rejected') {
    let extra: Record<string, any> = {};
    if (status === 'accepted') {
      const match = await lookupPrice(item.item_name, Number(item.quantity || 1), item.unit);
      if (match.found && match.price != null) {
        extra = {
          estimated_price: Number(match.price),
          retailer_name: 'Chronodrive',
          retailer_product_name: match.productName || item.item_name,
          retailer_package: match.packageText || null,
          retailer_price: Number(match.price),
          retailer_price_per_unit: match.pricePerUnit || null,
          retailer_url: match.url || null,
          retailer_confidence: match.confidence ?? null,
          retailer_checked_at: match.checkedAt || new Date().toISOString(),
        };
      }
    }
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ proposal_status: status, checked: false, ...extra })
      .eq('id', item.id);
    if (error) alert(error.message);
    else await fetchItems(listId!);
  }

  async function reconsiderRejected() {
    if (!listId) return;
    const rejectedIds = items.filter(x => x.proposal_status === 'rejected').map(x => x.id);
    if (!rejectedIds.length) return;
    const { error } = await supabase.from('shopping_list_items').update({ proposal_status: 'pending' }).in('id', rejectedIds);
    if (error) alert(error.message);
    else await fetchItems(listId);
  }

  async function complete() {
    if (!listId) return;
    if (!confirm('Terminer cette liste de courses et en créer une nouvelle ?')) return;
    const { error } = await supabase.from('shopping_lists').update({ status: 'completed' }).eq('id', listId);
    if (error) alert(error.message);
    else {
      setListId(null);
      setItems([]);
      await load();
    }
  }

  const pending = useMemo(() => items.filter(x => x.proposal_status === 'pending'), [items]);
  const accepted = useMemo(() => items.filter(x => x.proposal_status === 'accepted'), [items]);
  const rejectedCount = useMemo(() => items.filter(x => x.proposal_status === 'rejected').length, [items]);
  const total = accepted.filter(x => !x.checked).reduce((a, b) => a + Number(b.estimated_price || 0), 0);

  return <SafeAreaView style={s.safe}>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={s.c}>
      <AppHeader title="Courses" subtitle="Mijoty compare tes recettes avec ton stock et vérifie les prix chez Chronodrive."/>

      <Card>
        <Text style={s.total}>Reste estimé : {total.toFixed(2)} €</Text>
        <Text style={s.small}>Prix Chronodrive quand une correspondance fiable est trouvée.</Text>
        <Text style={s.small}>{accepted.filter(x => x.checked).length} article(s) coché(s) sur {accepted.length}</Text>
        {rejectedCount > 0 && <Text style={s.small}>{rejectedCount} proposition(s) refusée(s)</Text>}
      </Card>
      {rejectedCount > 0 && <Pressable style={s.reconsider} onPress={reconsiderRejected}><Text style={s.reconsiderText}>Réexaminer les propositions refusées</Text></Pressable>}

      <View style={s.actionRow}>
        <View style={{ flex: 1 }}><PrimaryButton label="Ajouter un article" onPress={() => setModal(true)} /></View>
        <Pressable style={s.refreshButton} disabled={syncing || !listId} onPress={() => listId && syncRecipeSuggestions(listId, items)}>
          <Text style={s.refreshText}>{syncing ? 'Analyse…' : 'Actualiser les propositions'}</Text>
        </Pressable>
      </View>

      <Text style={s.section}>Propositions à valider</Text>
      <Text style={s.sectionHelp}>Elles ne sont pas encore dans ta liste : accepte ou refuse chaque proposition.</Text>
      {pending.length === 0 ? <EmptyState>Aucun ingrédient manquant détecté pour les recettes planifiées.</EmptyState> : pending.map(item =>
        <Card key={item.id} style={{ marginTop: 10 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.item_name}</Text>
              <Text style={s.qty}>{Number(item.quantity || 1)} {item.unit || ''}</Text>
              {!!item.source_label && <Text style={s.source}>{item.source_label}</Text>}
            </View>
          </View>
          <View style={s.decisionRow}>
            <Pressable style={[s.decision, s.reject]} onPress={() => decide(item, 'rejected')}><Text style={s.rejectText}>Refuser</Text></Pressable>
            <Pressable style={[s.decision, s.accept]} onPress={() => decide(item, 'accepted')}><Text style={s.acceptText}>Accepter</Text></Pressable>
          </View>
        </Card>)}

      <Text style={s.section}>Ma liste de courses</Text>
      {accepted.length === 0 && <EmptyState>Ta liste validée est vide.</EmptyState>}
      {accepted.map(item => <Pressable key={item.id} onPress={() => toggle(item)}>
        <Card style={{ marginTop: 10, opacity: item.checked ? .55 : 1 }}>
          <View style={s.row}>
            <Text style={s.check}>{item.checked ? '✓' : '○'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.item_name}</Text>
              <Text style={s.small}>{Number(item.quantity || 1)} {item.unit || ''}</Text>
              {item.source_key && <Text style={s.auto}>Ajouté depuis une recette</Text>}
              {item.retailer_name === 'Chronodrive' && <View style={s.chronoBox}>
                <Text style={s.chrono}>Chronodrive · {item.retailer_product_name || item.item_name}{item.retailer_package ? ` · ${item.retailer_package}` : ''}</Text>
                {!!item.retailer_price_per_unit && <Text style={s.chronoSub}>{item.retailer_price_per_unit}</Text>}
                {!!item.retailer_checked_at && <Text style={s.chronoSub}>Prix vérifié le {new Date(item.retailer_checked_at).toLocaleDateString('fr-FR')}</Text>}
                {!!item.retailer_url && <Pressable onPress={(e) => { e.stopPropagation?.(); Linking.openURL(item.retailer_url!); }}><Text style={s.chronoLink}>Voir chez Chronodrive</Text></Pressable>}
              </View>}
              {item.retailer_name !== 'Chronodrive' && <Text style={s.notFound}>Prix Chronodrive non vérifié</Text>}
            </View>
            <Text style={s.price}>{item.estimated_price != null ? `${Number(item.estimated_price).toFixed(2)} €` : '—'}</Text>
          </View>
        </Card>
      </Pressable>)}

      {accepted.length > 0 && <View style={{ marginTop: 16 }}><PrimaryButton label="Terminer mes courses" onPress={complete} /></View>}
    </ScrollView>

    <AppModal visible={modal} title="Ajouter un article" onClose={() => setModal(false)}>
      <Field label="Article" value={name} onChangeText={setName} />
      <Field label="Quantité" value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
      <Field label="Unité" value={unit} onChangeText={setUnit} />
      <Text style={s.lookupHelp}>Mijoty vérifiera automatiquement le prix actuel chez Chronodrive avant l'ajout.</Text>
      <Field label="Prix manuel de secours (€)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      {!!priceMessage && <Text style={s.lookupStatus}>{priceMessage}</Text>}
      <ModalButton label={priceChecking ? "Recherche Chronodrive…" : "Ajouter à la liste"} onPress={add} />
    </AppModal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  c: { padding: 18, maxWidth: 900, width: '100%', alignSelf: 'center' },
  h: { fontSize: 30, fontWeight: '900', color: colors.brown },
  p: { color: colors.muted, marginTop: 6, marginBottom: 16 },
  total: { fontSize: 22, fontWeight: '900', color: colors.terracotta },
  small: { fontSize: 12, color: colors.muted, marginTop: 4 },
  actionRow: { marginTop: 12, gap: 8 },
  reconsider: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6 },
  reconsiderText: { color: colors.terracotta, fontWeight: '800', fontSize: 12 },
  refreshButton: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.terracotta, alignItems: 'center' },
  refreshText: { color: colors.terracotta, fontWeight: '800' },
  section: { fontSize: 20, fontWeight: '900', color: colors.brown, marginTop: 24, marginBottom: 4 },
  sectionHelp: { color: colors.muted, lineHeight: 19, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { fontSize: 24, color: colors.sage },
  name: { fontWeight: '800', color: colors.brown, fontSize: 16 },
  qty: { color: colors.terracotta, fontWeight: '800', marginTop: 4 },
  source: { color: colors.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  auto: { color: colors.sage, fontSize: 11, fontWeight: '800', marginTop: 4 },
  price: { fontWeight: '900', color: colors.brown },
  chronoBox: { marginTop: 6 },
  chrono: { color: colors.sage, fontSize: 11, fontWeight: '900' },
  chronoSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  chronoLink: { color: colors.terracotta, fontSize: 11, fontWeight: '800', marginTop: 4 },
  notFound: { color: colors.muted, fontSize: 10, marginTop: 5, fontStyle: 'italic' },
  lookupHelp: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  lookupStatus: { color: colors.terracotta, fontWeight: '700', fontSize: 12, marginVertical: 6 },
  decisionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  decision: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1 },
  reject: { borderColor: colors.border, backgroundColor: colors.white },
  accept: { borderColor: colors.sage, backgroundColor: colors.sage },
  rejectText: { color: colors.brown, fontWeight: '800' },
  acceptText: { color: '#fff', fontWeight: '900' },
});

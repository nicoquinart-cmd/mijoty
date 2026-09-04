import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppModal, Field, ModalButton } from '@/components/Forms';
import { AppHeader, Card, EmptyState, PrimaryButton, SectionTitle } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { isoDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Recipe = {
  id: string;
  household_id?: string | null;
  title: string;
  default_portions: number;
  kcal_per_portion: number | null;
  estimated_cost: number | null;
  prep_minutes: number | null;
};

type Plan = { id: string; meal_date: string; portions: number; recipes: Recipe | null };
type Ingredient = { id: string; ingredient_name: string; quantity: number | null; unit: string | null };
type RecipeStep = { id: string; step_number: number; instruction: string; duration_minutes: number | null };
type DraftIngredient = { ingredient_name: string; quantity: string; unit: string };
type DraftStep = { instruction: string; duration_minutes: string };

const emptyIngredient = (): DraftIngredient => ({ ingredient_name: '', quantity: '', unit: '' });
const emptyStep = (): DraftStep => ({ instruction: '', duration_minutes: '' });

export default function Meals() {
  const { householdId } = useApp();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [portions, setPortions] = useState('4');
  const [kcal, setKcal] = useState('');
  const [cost, setCost] = useState('');
  const [minutes, setMinutes] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([emptyIngredient()]);
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([emptyStep()]);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newIngredient, setNewIngredient] = useState<DraftIngredient>(emptyIngredient());
  const [newStep, setNewStep] = useState<DraftStep>(emptyStep());
  const [cookMode, setCookMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const load = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const { data: r, error: re } = await supabase
        .from('recipes')
        .select('id,household_id,title,default_portions,kcal_per_portion,estimated_cost,prep_minutes')
        .or(`household_id.eq.${householdId},household_id.is.null`)
        .order('created_at', { ascending: false });
      if (re) throw re;
      setRecipes((r || []) as Recipe[]);

      const today = isoDate(new Date());
      const end = new Date();
      end.setDate(end.getDate() + 14);
      const { data: p, error: pe } = await supabase
        .from('meal_plans')
        .select('id,meal_date,portions,recipes(id,household_id,title,default_portions,kcal_per_portion,estimated_cost,prep_minutes)')
        .eq('household_id', householdId)
        .gte('meal_date', today)
        .lte('meal_date', isoDate(end))
        .order('meal_date');
      if (pe) throw pe;
      setPlans((p || []) as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { load(); }, [load]);

  function resetCreate() {
    setTitle(''); setPortions('4'); setKcal(''); setCost(''); setMinutes('');
    setDraftIngredients([emptyIngredient()]);
    setDraftSteps([emptyStep()]);
  }

  function updateIngredient(index: number, patch: Partial<DraftIngredient>) {
    setDraftIngredients(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function updateStep(index: number, patch: Partial<DraftStep>) {
    setDraftSteps(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function addRecipe() {
    if (!householdId || !title.trim()) { alert('Donnez un nom à la recette.'); return; }
    setSaving(true);
    let recipeId: string | null = null;
    try {
      const { data: recipe, error } = await supabase.from('recipes').insert({
        household_id: householdId,
        title: title.trim(),
        default_portions: Number(portions) || 4,
        kcal_per_portion: kcal ? Number(kcal) : null,
        estimated_cost: cost ? Number(cost) : null,
        prep_minutes: minutes ? Number(minutes) : null,
      }).select('id').single();
      if (error) throw error;
      recipeId = recipe.id;

      const ingredientRows = draftIngredients
        .filter(i => i.ingredient_name.trim())
        .map(i => ({
          recipe_id: recipe.id,
          ingredient_name: i.ingredient_name.trim(),
          quantity: i.quantity ? Number(i.quantity.replace(',', '.')) : null,
          unit: i.unit.trim() || null,
        }));
      if (ingredientRows.length) {
        const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(ingredientRows);
        if (ingredientError) throw ingredientError;
      }

      const stepRows = draftSteps
        .filter(s => s.instruction.trim())
        .map((s, index) => ({
          recipe_id: recipe.id,
          step_number: index + 1,
          instruction: s.instruction.trim(),
          duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
        }));
      if (stepRows.length) {
        const { error: stepError } = await supabase.from('recipe_steps').insert(stepRows);
        if (stepError) throw stepError;
      }

      resetCreate();
      setCreateOpen(false);
      await load();
    } catch (e: any) {
      if (recipeId) await supabase.from('recipes').delete().eq('id', recipeId);
      alert(e?.message || 'Impossible d’enregistrer la recette.');
    } finally {
      setSaving(false);
    }
  }

  async function loadRecipeDetails(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setDetailOpen(true);
    setCookMode(false);
    setCurrentStep(0);
    setDetailLoading(true);
    try {
      const [{ data: ing, error: ingError }, { data: st, error: stepError }] = await Promise.all([
        supabase.from('recipe_ingredients').select('id,ingredient_name,quantity,unit').eq('recipe_id', recipe.id).order('id'),
        supabase.from('recipe_steps').select('id,step_number,instruction,duration_minutes').eq('recipe_id', recipe.id).order('step_number'),
      ]);
      if (ingError) throw ingError;
      if (stepError) throw stepError;
      setIngredients((ing || []) as Ingredient[]);
      setSteps((st || []) as RecipeStep[]);
    } catch (e: any) {
      alert(e?.message || 'Impossible de charger la recette.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function appendIngredient() {
    if (!selectedRecipe || !newIngredient.ingredient_name.trim()) return;
    const { error } = await supabase.from('recipe_ingredients').insert({
      recipe_id: selectedRecipe.id,
      ingredient_name: newIngredient.ingredient_name.trim(),
      quantity: newIngredient.quantity ? Number(newIngredient.quantity.replace(',', '.')) : null,
      unit: newIngredient.unit.trim() || null,
    });
    if (error) alert(error.message);
    else { setNewIngredient(emptyIngredient()); loadRecipeDetails(selectedRecipe); }
  }

  async function appendStep() {
    if (!selectedRecipe || !newStep.instruction.trim()) return;
    const nextNumber = steps.length ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    const { error } = await supabase.from('recipe_steps').insert({
      recipe_id: selectedRecipe.id,
      step_number: nextNumber,
      instruction: newStep.instruction.trim(),
      duration_minutes: newStep.duration_minutes ? Number(newStep.duration_minutes) : null,
    });
    if (error) alert(error.message);
    else { setNewStep(emptyStep()); loadRecipeDetails(selectedRecipe); }
  }

  async function removeIngredient(id: string) {
    const { error } = await supabase.from('recipe_ingredients').delete().eq('id', id);
    if (error) alert(error.message);
    else if (selectedRecipe) loadRecipeDetails(selectedRecipe);
  }

  async function removeStep(id: string) {
    const { error } = await supabase.from('recipe_steps').delete().eq('id', id);
    if (error) alert(error.message);
    else if (selectedRecipe) loadRecipeDetails(selectedRecipe);
  }

  async function planWeek() {
    if (!householdId || recipes.length === 0) { alert('Ajoutez au moins une recette.'); return; }
    const start = new Date(); const end = new Date(); end.setDate(end.getDate() + 6);
    await supabase.from('meal_plans').delete().eq('household_id', householdId).eq('meal_type', 'dinner').gte('meal_date', isoDate(start)).lte('meal_date', isoDate(end));
    const rows = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); const r = recipes[i % recipes.length];
      return { household_id: householdId, meal_date: isoDate(d), meal_type: 'dinner', recipe_id: r.id, portions: r.default_portions };
    });
    const { error } = await supabase.from('meal_plans').insert(rows);
    if (error) alert(error.message); else load();
  }

  const recipeCostPerPortion = useMemo(() => selectedRecipe?.estimated_cost && selectedRecipe.default_portions
    ? Number(selectedRecipe.estimated_cost) / Number(selectedRecipe.default_portions)
    : null, [selectedRecipe]);

  return <SafeAreaView style={s.safe}>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={s.c}>
      <AppHeader title="Repas"/>
      <Text style={s.p}>Créez vos recettes avec ingrédients, quantités et préparation étape par étape.</Text>
      <View style={s.buttons}>
        <View style={{ flex: 1 }}><PrimaryButton label="Ajouter une recette" onPress={() => setCreateOpen(true)} /></View>
        <View style={{ flex: 1 }}><PrimaryButton label="Planifier 7 dîners" onPress={planWeek} /></View>
      </View>

      <SectionTitle>Planning à venir</SectionTitle>
      {plans.length === 0 && <EmptyState>Aucun repas planifié pour les 14 prochains jours.</EmptyState>}
      {plans.map(p => <Pressable key={p.id} onPress={() => p.recipes && loadRecipeDetails(p.recipes)}>
        <Card style={{ marginTop: 10 }}><View style={s.row}><Text style={s.day}>{new Date(`${p.meal_date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })}</Text><View style={{ flex: 1 }}><Text style={s.name}>{p.recipes?.title || 'Repas'}</Text><Text style={s.meta}>{Number(p.portions)} portions{p.recipes?.kcal_per_portion ? ` · ${p.recipes.kcal_per_portion} kcal/portion` : ''}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View></Card>
      </Pressable>)}

      <SectionTitle>Mes recettes</SectionTitle>
      {recipes.length === 0 && <EmptyState>Aucune recette enregistrée.</EmptyState>}
      {recipes.map(r => <Pressable key={r.id} onPress={() => loadRecipeDetails(r)}>
        <Card style={{ marginTop: 10 }}>
          <View style={s.recipeHead}><View style={{ flex: 1 }}><Text style={s.name}>{r.title}</Text><Text style={s.meta}>{r.default_portions} portions{r.kcal_per_portion ? ` · ${r.kcal_per_portion} kcal/portion` : ''}{r.estimated_cost ? ` · ${Number(r.estimated_cost).toFixed(2)} € la recette` : ''}{r.prep_minutes ? ` · ${r.prep_minutes} min` : ''}</Text></View><View style={s.openBadge}><Text style={s.openBadgeText}>Voir</Text><Ionicons name="chevron-forward" size={16} color={colors.terracotta} /></View></View>
        </Card>
      </Pressable>)}
    </ScrollView>

    <AppModal visible={createOpen} title="Nouvelle recette" onClose={() => setCreateOpen(false)}>
      <Field label="Nom" value={title} onChangeText={setTitle} placeholder="Ex. Poulet curry coco" />
      <View style={s.twoCols}><View style={{ flex: 1 }}><Field label="Portions" value={portions} onChangeText={setPortions} keyboardType="numeric" /></View><View style={{ flex: 1 }}><Field label="Préparation (min)" value={minutes} onChangeText={setMinutes} keyboardType="numeric" /></View></View>
      <View style={s.twoCols}><View style={{ flex: 1 }}><Field label="Kcal / portion" value={kcal} onChangeText={setKcal} keyboardType="numeric" /></View><View style={{ flex: 1 }}><Field label="Coût recette (€)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" /></View></View>

      <Text style={s.modalSection}>Ingrédients</Text>
      <Text style={s.help}>Ajoutez les quantités pour le nombre de portions indiqué ci-dessus.</Text>
      {draftIngredients.map((item, index) => <View key={index} style={s.editorCard}>
        <Field label={`Ingrédient ${index + 1}`} value={item.ingredient_name} onChangeText={v => updateIngredient(index, { ingredient_name: v })} placeholder="Ex. Blanc de poulet" />
        <View style={s.twoCols}><View style={{ flex: 1 }}><Field label="Quantité" value={item.quantity} onChangeText={v => updateIngredient(index, { quantity: v })} keyboardType="decimal-pad" placeholder="500" /></View><View style={{ flex: 1 }}><Field label="Unité" value={item.unit} onChangeText={v => updateIngredient(index, { unit: v })} placeholder="g, ml, pièce..." /></View></View>
        {draftIngredients.length > 1 && <Pressable onPress={() => setDraftIngredients(items => items.filter((_, i) => i !== index))}><Text style={s.remove}>Supprimer cet ingrédient</Text></Pressable>}
      </View>)}
      <ModalButton secondary label="+ Ajouter un ingrédient" onPress={() => setDraftIngredients(items => [...items, emptyIngredient()])} />

      <Text style={s.modalSection}>Préparation pas à pas</Text>
      {draftSteps.map((item, index) => <View key={index} style={s.editorCard}>
        <Field multiline label={`Étape ${index + 1}`} value={item.instruction} onChangeText={v => updateStep(index, { instruction: v })} placeholder="Décrivez précisément ce qu'il faut faire..." />
        <Field label="Durée de cette étape (min, facultatif)" value={item.duration_minutes} onChangeText={v => updateStep(index, { duration_minutes: v })} keyboardType="numeric" />
        {draftSteps.length > 1 && <Pressable onPress={() => setDraftSteps(items => items.filter((_, i) => i !== index))}><Text style={s.remove}>Supprimer cette étape</Text></Pressable>}
      </View>)}
      <ModalButton secondary label="+ Ajouter une étape" onPress={() => setDraftSteps(items => [...items, emptyStep()])} />
      <ModalButton label={saving ? 'Enregistrement…' : 'Enregistrer la recette'} disabled={saving} onPress={addRecipe} />
    </AppModal>

    <AppModal visible={detailOpen} title={selectedRecipe?.title || 'Recette'} onClose={() => { setDetailOpen(false); setCookMode(false); }}>
      {detailLoading ? <Text style={s.help}>Chargement…</Text> : cookMode ? <View>
        <View style={s.progressHead}><Text style={s.progressText}>Étape {Math.min(currentStep + 1, steps.length)} / {steps.length}</Text>{steps[currentStep]?.duration_minutes ? <Text style={s.timer}>⏱ {steps[currentStep].duration_minutes} min</Text> : null}</View>
        <View style={s.stepFocus}><Text style={s.stepNumber}>{currentStep + 1}</Text><Text style={s.stepInstruction}>{steps[currentStep]?.instruction}</Text></View>
        <View style={s.twoCols}>
          <View style={{ flex: 1 }}><ModalButton secondary disabled={currentStep === 0} label="← Précédente" onPress={() => setCurrentStep(v => Math.max(0, v - 1))} /></View>
          <View style={{ flex: 1 }}><ModalButton label={currentStep === steps.length - 1 ? 'Terminer ✓' : 'Suivante →'} onPress={() => currentStep === steps.length - 1 ? setCookMode(false) : setCurrentStep(v => v + 1)} /></View>
        </View>
        <ModalButton secondary label="Quitter le mode pas à pas" onPress={() => setCookMode(false)} />
      </View> : <View>
        <View style={s.summary}><Text style={s.summaryText}>👥 {selectedRecipe?.default_portions} portions</Text>{selectedRecipe?.prep_minutes ? <Text style={s.summaryText}>⏱ {selectedRecipe.prep_minutes} min</Text> : null}{recipeCostPerPortion ? <Text style={s.summaryText}>💶 {recipeCostPerPortion.toFixed(2)} €/portion</Text> : null}</View>

        <Text style={s.modalSection}>Ingrédients</Text>
        {ingredients.length === 0 ? <Text style={s.help}>Aucun ingrédient renseigné.</Text> : ingredients.map(i => <View key={i.id} style={s.detailRow}><Text style={s.bullet}>•</Text><Text style={s.detailText}>{i.quantity != null ? `${Number(i.quantity)}${i.unit ? ` ${i.unit}` : ''} ` : ''}{i.ingredient_name}</Text>{selectedRecipe?.household_id ? <Pressable onPress={() => removeIngredient(i.id)}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable> : null}</View>)}

        {selectedRecipe?.household_id && <View style={s.addBox}><Text style={s.subTitle}>Ajouter un ingrédient</Text><Field label="Nom" value={newIngredient.ingredient_name} onChangeText={v => setNewIngredient(x => ({ ...x, ingredient_name: v }))} /><View style={s.twoCols}><View style={{ flex: 1 }}><Field label="Quantité" value={newIngredient.quantity} onChangeText={v => setNewIngredient(x => ({ ...x, quantity: v }))} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Unité" value={newIngredient.unit} onChangeText={v => setNewIngredient(x => ({ ...x, unit: v }))} /></View></View><ModalButton secondary label="Ajouter l'ingrédient" onPress={appendIngredient} /></View>}

        <Text style={s.modalSection}>Préparation</Text>
        {steps.length === 0 ? <Text style={s.help}>Aucune étape renseignée.</Text> : steps.map(st => <View key={st.id} style={s.stepCard}><View style={s.stepTop}><Text style={s.stepChip}>{st.step_number}</Text><View style={{ flex: 1 }}><Text style={s.detailText}>{st.instruction}</Text>{st.duration_minutes ? <Text style={s.meta}>⏱ {st.duration_minutes} min</Text> : null}</View>{selectedRecipe?.household_id ? <Pressable onPress={() => removeStep(st.id)}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable> : null}</View></View>)}

        {steps.length > 0 && <ModalButton label="Démarrer la recette pas à pas" onPress={() => { setCurrentStep(0); setCookMode(true); }} />}

        {selectedRecipe?.household_id && <View style={s.addBox}><Text style={s.subTitle}>Ajouter une étape</Text><Field multiline label={`Étape ${steps.length + 1}`} value={newStep.instruction} onChangeText={v => setNewStep(x => ({ ...x, instruction: v }))} /><Field label="Durée (min, facultatif)" value={newStep.duration_minutes} onChangeText={v => setNewStep(x => ({ ...x, duration_minutes: v }))} keyboardType="numeric" /><ModalButton secondary label="Ajouter l'étape" onPress={appendStep} /></View>}
      </View>}
    </AppModal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  c: { padding: 18, maxWidth: 900, width: '100%', alignSelf: 'center' },
  h: { fontSize: 30, fontWeight: '900', color: colors.brown },
  p: { color: colors.muted, marginTop: 6, marginBottom: 16 },
  buttons: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  day: { fontSize: 15, fontWeight: '900', color: colors.terracotta, width: 60, textTransform: 'capitalize' },
  name: { fontWeight: '800', fontSize: 16, color: colors.brown },
  meta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  recipeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  openBadge: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  openBadgeText: { color: colors.terracotta, fontWeight: '800' },
  twoCols: { flexDirection: 'row', gap: 10 },
  modalSection: { fontSize: 19, fontWeight: '900', color: colors.brown, marginTop: 20, marginBottom: 6 },
  help: { color: colors.muted, lineHeight: 20, marginBottom: 10 },
  editorCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginTop: 10, backgroundColor: '#fff' },
  remove: { color: colors.red, fontWeight: '700', marginBottom: 4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryText: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, color: colors.brown, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  bullet: { color: colors.terracotta, fontSize: 22, fontWeight: '900' },
  detailText: { flex: 1, color: colors.brown, fontSize: 15, lineHeight: 22 },
  addBox: { marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  subTitle: { fontSize: 15, color: colors.brown, fontWeight: '900', marginBottom: 10 },
  stepCard: { backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  stepTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepChip: { width: 30, height: 30, borderRadius: 15, textAlign: 'center', textAlignVertical: 'center', paddingTop: 5, backgroundColor: colors.terracotta, color: '#fff', fontWeight: '900' },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  progressText: { color: colors.terracotta, fontWeight: '900', fontSize: 16 },
  timer: { color: colors.brown, fontWeight: '800' },
  stepFocus: { minHeight: 230, justifyContent: 'center', alignItems: 'center', padding: 22, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  stepNumber: { fontSize: 22, color: colors.terracotta, fontWeight: '900', marginBottom: 18 },
  stepInstruction: { color: colors.brown, fontSize: 22, lineHeight: 31, fontWeight: '800', textAlign: 'center' },
});

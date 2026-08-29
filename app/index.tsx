import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal, Field, ModalButton } from '@/components/Forms';
import { Card, Metric, PrimaryButton, SectionTitle } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { daysInPeriodRemaining, monthLabel, nextMonthStart } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Budget = { id:string; month_start:string; amount:number };

export default function Home(){
  const { householdId, memberName } = useApp();
  const [budget,setBudget]=useState<Budget|null>(null); const [spent,setSpent]=useState(0); const [loading,setLoading]=useState(false);
  const [inventoryCount,setInventoryCount]=useState(0); const [expiringCount,setExpiringCount]=useState(0); const [lowCount,setLowCount]=useState(0); const [shoppingTotal,setShoppingTotal]=useState(0); const [mealCount,setMealCount]=useState(0);
  const [budgetModal,setBudgetModal]=useState(false); const [expenseModal,setExpenseModal]=useState(false); const [budgetAmount,setBudgetAmount]=useState('600'); const [expenseAmount,setExpenseAmount]=useState(''); const [store,setStore]=useState('');

  const load=useCallback(async()=>{
    if(!householdId)return; setLoading(true);
    try{
      const {data:b,error:be}=await supabase.from('budgets').select('id,month_start,amount').eq('household_id',householdId).order('month_start',{ascending:false}).limit(1).maybeSingle(); if(be)throw be;
      const selected=(b as Budget|null); setBudget(selected); if(selected)setBudgetAmount(String(Number(selected.amount)));
      let sum=0;
      if(selected){ const {data:e,error:ee}=await supabase.from('expenses').select('amount').eq('household_id',householdId).gte('expense_date',selected.month_start).lt('expense_date',nextMonthStart(selected.month_start)); if(ee)throw ee; sum=(e||[]).reduce((a:any,x:any)=>a+Number(x.amount||0),0); }
      setSpent(sum);
      const {data:inv,error:ie}=await supabase.from('inventory_items').select('quantity,low_stock_threshold,expiry_date').eq('household_id',householdId); if(ie)throw ie;
      const now=new Date(); now.setHours(12,0,0,0); const soon=new Date(now); soon.setDate(soon.getDate()+7);
      setInventoryCount(inv?.length||0); setLowCount((inv||[]).filter((x:any)=>x.low_stock_threshold!=null&&Number(x.quantity)<=Number(x.low_stock_threshold)).length); setExpiringCount((inv||[]).filter((x:any)=>x.expiry_date&&new Date(`${x.expiry_date}T12:00:00`)<=soon).length);
      const {data:lists}=await supabase.from('shopping_lists').select('id').eq('household_id',householdId).eq('status','open').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(lists?.id){const {data:items}=await supabase.from('shopping_list_items').select('estimated_price,checked').eq('shopping_list_id',lists.id);setShoppingTotal((items||[]).filter((x:any)=>!x.checked).reduce((a:any,x:any)=>a+Number(x.estimated_price||0),0));} else setShoppingTotal(0);
      const today=new Date().toISOString().slice(0,10); const in7=new Date();in7.setDate(in7.getDate()+7); const {count}=await supabase.from('meal_plans').select('*',{count:'exact',head:true}).eq('household_id',householdId).gte('meal_date',today).lte('meal_date',in7.toISOString().slice(0,10)); setMealCount(count||0);
    }catch(e){console.error(e);}finally{setLoading(false)}
  },[householdId]);
  useEffect(()=>{load()},[load]);

  const amount=Number(budget?.amount||0), remaining=Math.max(0,amount-spent), pct=amount?Math.min(100,Math.round(spent/amount*100)):0, days=budget?daysInPeriodRemaining(budget.month_start):0;
  const weeklyTarget=days>0?remaining/(days/7):remaining;
  const forecast=useMemo(()=>{if(!budget)return 0; const start=new Date(`${budget.month_start}T12:00:00`),today=new Date();today.setHours(12,0,0,0); if(today<start||days===0)return spent; const elapsed=Math.max(1,Math.round((today.getTime()-start.getTime())/86400000)+1); const totalDays=elapsed+days-1; return spent/elapsed*totalDays;},[budget,spent,days]);

  async function saveBudget(){if(!householdId||!budgetAmount)return; const month=budget?.month_start||new Date().toISOString().slice(0,7)+'-01'; const {error}=await supabase.from('budgets').upsert({household_id:householdId,month_start:month,amount:Number(budgetAmount)},{onConflict:'household_id,month_start'}); if(error)alert(error.message); else {setBudgetModal(false);load();}}
  async function addExpense(){if(!householdId||!expenseAmount)return; const date=budget?.month_start?`${budget.month_start.slice(0,7)}-${String(Math.min(new Date().getDate(),28)).padStart(2,'0')}`:new Date().toISOString().slice(0,10); const {error}=await supabase.from('expenses').insert({household_id:householdId,expense_date:date,store_name:store||null,amount:Number(expenseAmount),category:'groceries'}); if(error)alert(error.message); else {setExpenseAmount('');setStore('');setExpenseModal(false);load();}}

  return <SafeAreaView style={s.safe}><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>} contentContainerStyle={s.container}>
    <Text style={s.brand}>Mijoty</Text><Text style={s.hello}>Bonjour {memberName||''} 👋</Text><Text style={s.sub}>Vos données sont maintenant synchronisées avec Supabase.</Text>
    <Card><Text style={s.cardTitle}>Budget courses — {budget?monthLabel(budget.month_start):'à définir'}</Text>{budget?<><View style={s.amountRow}><Text style={s.amount}>{spent.toFixed(0)} €</Text><Text style={s.outOf}> / {amount.toFixed(0)} €</Text></View><View style={s.track}><View style={[s.fill,{width:`${pct}%`}]} /></View><View style={s.metrics}><Metric value={`${remaining.toFixed(0)} €`} label="disponibles" accent/><Metric value={`${days}`} label="jours restants"/><Metric value={`${forecast.toFixed(0)} €`} label="prévision"/></View><View style={[s.good,forecast>amount&&{backgroundColor:'#FBE8E5'}]}><Text style={[s.goodText,forecast>amount&&{color:colors.red}]}>{forecast<=amount?'✓ Trajectoire compatible avec le budget':`⚠ Risque de dépassement d’environ ${(forecast-amount).toFixed(0)} €`}</Text></View></>:<Text style={s.empty}>Aucun budget trouvé.</Text>}<View style={s.actions}><View style={{flex:1}}><PrimaryButton label="Modifier le budget" onPress={()=>setBudgetModal(true)}/></View><View style={{flex:1}}><PrimaryButton label="Ajouter une dépense" onPress={()=>setExpenseModal(true)}/></View></View></Card>
    <Card style={{marginTop:14,backgroundColor:colors.softTerracotta}}><Text style={s.optimizeTitle}>🎯 Cap budget</Text><Text style={s.optimizeText}>Pour rester dans l’enveloppe, votre rythme conseillé est d’environ <Text style={{fontWeight:'900'}}>{weeklyTarget.toFixed(0)} € par semaine</Text> sur la période restante.</Text></Card>
    <SectionTitle>Cette semaine</SectionTitle><View style={s.grid}><Card style={s.mini}><Text style={s.miniN}>{mealCount}</Text><Text style={s.miniL}>repas planifiés</Text></Card><Card style={s.mini}><Text style={s.miniN}>{shoppingTotal.toFixed(0)} €</Text><Text style={s.miniL}>courses restantes estimées</Text></Card></View><View style={s.grid}><Card style={s.mini}><Text style={s.miniN}>{inventoryCount}</Text><Text style={s.miniL}>produits en stock</Text></Card><Card style={s.mini}><Text style={[s.miniN,{color:colors.red}]}>{expiringCount}</Text><Text style={s.miniL}>à consommer sous 7 jours</Text></Card></View>
    <SectionTitle>À surveiller</SectionTitle><Card><Text style={s.tip}>📦 {lowCount} produit(s) au seuil de stock faible</Text><Text style={s.tip}>🛒 {shoppingTotal.toFixed(2)} € encore estimés sur la liste ouverte</Text><Text style={s.tip}>💶 {spent.toFixed(2)} € de dépenses enregistrées sur la période</Text></Card>
  </ScrollView>
  <AppModal visible={budgetModal} title="Budget mensuel" onClose={()=>setBudgetModal(false)}><Field label="Montant (€)" value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="decimal-pad"/><ModalButton label="Enregistrer" onPress={saveBudget}/></AppModal>
  <AppModal visible={expenseModal} title="Ajouter une dépense" onClose={()=>setExpenseModal(false)}><Field label="Montant (€)" value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="decimal-pad"/><Field label="Enseigne" value={store} onChangeText={setStore} placeholder="Ex. Carrefour"/><ModalButton label="Ajouter la dépense" onPress={addExpense}/></AppModal>
  </SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.cream},container:{padding:18,paddingBottom:32,maxWidth:900,width:'100%',alignSelf:'center'},brand:{fontSize:32,fontWeight:'900',color:colors.terracotta,marginTop:4},hello:{fontSize:28,fontWeight:'900',color:colors.brown,marginTop:18},sub:{fontSize:15,color:colors.muted,marginBottom:18},cardTitle:{fontSize:16,fontWeight:'800',color:colors.brown},amountRow:{flexDirection:'row',alignItems:'baseline',marginTop:15},amount:{fontSize:42,fontWeight:'900',color:colors.terracotta},outOf:{fontSize:19,color:colors.muted},track:{height:11,backgroundColor:'#F1E7DE',borderRadius:20,overflow:'hidden',marginTop:14},fill:{height:'100%',backgroundColor:colors.terracotta,borderRadius:20},metrics:{flexDirection:'row',marginTop:20},good:{marginTop:18,padding:14,borderRadius:14,backgroundColor:colors.softSage},goodText:{fontWeight:'700',color:'#58735E'},actions:{flexDirection:'row',gap:8,marginTop:14},optimizeTitle:{fontSize:18,fontWeight:'900',color:colors.brown},optimizeText:{fontSize:14,lineHeight:20,color:colors.muted,marginTop:5},grid:{flexDirection:'row',gap:10,marginBottom:10},mini:{flex:1,alignItems:'center',minHeight:105,justifyContent:'center'},miniN:{fontSize:25,fontWeight:'900',color:colors.brown},miniL:{fontSize:12,textAlign:'center',color:colors.muted,marginTop:5},tip:{fontSize:14,color:colors.brown,paddingVertical:8},empty:{color:colors.muted,marginTop:16}});

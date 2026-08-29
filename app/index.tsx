import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Metric, PrimaryButton, SectionTitle } from '@/components/ui';
import { colors } from '@/lib/theme';
import { demoBudget } from '@/lib/demo';

export default function Home(){
  const remaining=demoBudget.budget-demoBudget.spent; const pct=Math.round(demoBudget.spent/demoBudget.budget*100);
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
    <Text style={s.brand}>Mijoty</Text><Text style={s.hello}>Bonjour 👋</Text><Text style={s.sub}>Voici votre situation aujourd’hui.</Text>
    <Card>
      <Text style={s.cardTitle}>Budget courses — Septembre</Text>
      <View style={s.amountRow}><Text style={s.amount}>{demoBudget.spent} €</Text><Text style={s.outOf}> / {demoBudget.budget} €</Text></View>
      <View style={s.track}><View style={[s.fill,{width:`${pct}%`}]} /></View>
      <View style={s.metrics}><Metric value={`${remaining} €`} label="disponibles" accent/><Metric value={`${demoBudget.daysLeft}`} label="jours restants"/><Metric value={`${demoBudget.forecast} €`} label="prévision fin de mois"/></View>
      <View style={s.good}><Text style={s.goodText}>✓ Vous êtes dans votre budget · 21 € sous votre objectif</Text></View>
    </Card>
    <Card style={{marginTop:14,backgroundColor:colors.softTerracotta}}><Text style={s.optimizeTitle}>🎯 Optimiser mon budget</Text><Text style={s.optimizeText}>Je vous aide à économiser et à tenir votre budget en utilisant d’abord ce que vous avez déjà.</Text><View style={{marginTop:14}}><PrimaryButton label="C’est parti"/></View></Card>
    <SectionTitle>Cette semaine</SectionTitle>
    <View style={s.grid}><Card style={s.mini}><Text style={s.miniN}>7</Text><Text style={s.miniL}>repas prévus</Text></Card><Card style={s.mini}><Text style={s.miniN}>54 €</Text><Text style={s.miniL}>courses estimées</Text></Card></View>
    <View style={s.grid}><Card style={s.mini}><Text style={s.miniN}>12</Text><Text style={s.miniL}>ingrédients déjà disponibles</Text></Card><Card style={s.mini}><Text style={[s.miniN,{color:colors.red}]}>3</Text><Text style={s.miniL}>produits à consommer vite</Text></Card></View>
    <SectionTitle>À ne pas manquer</SectionTitle>
    <Card><Text style={s.tip}>🏷️ 3 opportunités d’achat intéressantes</Text><Text style={s.tip}>🌿 18 € de gaspillage évitable cette semaine</Text><Text style={s.tip}>📦 8 produits à racheter bientôt</Text></Card>
  </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.cream},container:{padding:18,paddingBottom:32},brand:{fontSize:32,fontWeight:'900',color:colors.terracotta,marginTop:4},hello:{fontSize:28,fontWeight:'900',color:colors.brown,marginTop:18},sub:{fontSize:15,color:colors.muted,marginBottom:18},cardTitle:{fontSize:16,fontWeight:'800',color:colors.brown},amountRow:{flexDirection:'row',alignItems:'baseline',marginTop:15},amount:{fontSize:42,fontWeight:'900',color:colors.terracotta},outOf:{fontSize:19,color:colors.muted},track:{height:11,backgroundColor:'#F1E7DE',borderRadius:20,overflow:'hidden',marginTop:14},fill:{height:'100%',backgroundColor:colors.terracotta,borderRadius:20},metrics:{flexDirection:'row',marginTop:20},good:{marginTop:18,padding:14,borderRadius:14,backgroundColor:colors.softSage},goodText:{fontWeight:'700',color:'#58735E'},optimizeTitle:{fontSize:18,fontWeight:'900',color:colors.brown},optimizeText:{fontSize:14,lineHeight:20,color:colors.muted,marginTop:5},grid:{flexDirection:'row',gap:10,marginBottom:10},mini:{flex:1,alignItems:'center',minHeight:105,justifyContent:'center'},miniN:{fontSize:25,fontWeight:'900',color:colors.brown},miniL:{fontSize:12,textAlign:'center',color:colors.muted,marginTop:5},tip:{fontSize:14,color:colors.brown,paddingVertical:8},});

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthScreen } from '@/components/AuthScreen';

function RootContent() {
  const { session, loading, householdId } = useApp();
  if (loading || (session && !householdId)) return <View style={s.loading}><ActivityIndicator size="large" color={colors.terracotta} /></View>;
  if (!session) return <AuthScreen />;

  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.terracotta,tabBarInactiveTintColor:colors.brown,tabBarStyle:{height:78,paddingTop:7,paddingBottom:12,backgroundColor:'#fff',borderTopColor:colors.border}}}>
    <Tabs.Screen name="index" options={{title:'Accueil',tabBarIcon:({color,size})=><Ionicons name="home" color={color} size={size}/>}}/>
    <Tabs.Screen name="meals" options={{title:'Repas',tabBarIcon:({color,size})=><Ionicons name="restaurant" color={color} size={size}/>}}/>
    <Tabs.Screen name="stock" options={{title:'Stock',tabBarIcon:({color,size})=><Ionicons name="cube" color={color} size={size}/>}}/>
    <Tabs.Screen name="shopping" options={{title:'Courses',tabBarIcon:({color,size})=><Ionicons name="cart" color={color} size={size}/>}}/>
    <Tabs.Screen name="more" options={{title:'Plus',tabBarIcon:({color,size})=><Ionicons name="ellipsis-horizontal-circle" color={color} size={size}/>}}/>
  </Tabs>;
}

export default function RootLayout(){ return <AppProvider><RootContent/></AppProvider>; }
const s=StyleSheet.create({loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.cream}});

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

export default function RootLayout(){
  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.terracotta,tabBarInactiveTintColor:colors.brown,tabBarStyle:{height:78,paddingTop:7,paddingBottom:12,backgroundColor:'#fff',borderTopColor:colors.border}}}>
    <Tabs.Screen name="index" options={{title:'Accueil',tabBarIcon:({color,size})=><Ionicons name="home" color={color} size={size}/>}}/>
    <Tabs.Screen name="meals" options={{title:'Repas',tabBarIcon:({color,size})=><Ionicons name="restaurant" color={color} size={size}/>}}/>
    <Tabs.Screen name="stock" options={{title:'Stock',tabBarIcon:({color,size})=><Ionicons name="file-tray-stacked" color={color} size={size}/>}}/>
    <Tabs.Screen name="shopping" options={{title:'Courses',tabBarIcon:({color,size})=><Ionicons name="cart" color={color} size={size}/>}}/>
    <Tabs.Screen name="more" options={{title:'Plus',tabBarIcon:({color,size})=><Ionicons name="ellipsis-horizontal" color={color} size={size}/>}}/>
  </Tabs>
}

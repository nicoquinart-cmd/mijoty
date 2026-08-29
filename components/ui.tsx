import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';

export function Card({children, style}:{children:React.ReactNode; style?:ViewStyle}) { return <View style={[styles.card, style]}>{children}</View>; }
export function SectionTitle({children, right}:{children:React.ReactNode; right?:React.ReactNode}) { return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{children}</Text>{right}</View>; }
export function PrimaryButton({label,onPress,busy=false,disabled=false}:{label:string;onPress?:()=>void;busy?:boolean;disabled?:boolean}) { return <Pressable disabled={disabled||busy} onPress={onPress} style={[styles.button,(disabled||busy)&&{opacity:.55}]}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>{label}</Text>}</Pressable>; }
export function Metric({value,label,accent}:{value:string;label:string;accent?:boolean}) { return <View style={styles.metric}><Text style={[styles.metricValue,accent&&{color:colors.sage}]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
export function EmptyState({children}:{children:React.ReactNode}) { return <Card><Text style={styles.empty}>{children}</Text></Card>; }
const styles=StyleSheet.create({
  card:{backgroundColor:colors.white,borderRadius:20,padding:18,borderWidth:1,borderColor:colors.border,shadowColor:'#000',shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:3}},
  sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22,marginBottom:10},
  sectionTitle:{fontSize:20,fontWeight:'800',color:colors.brown},
  button:{backgroundColor:colors.terracotta,borderRadius:16,paddingVertical:14,paddingHorizontal:18,alignItems:'center'},
  buttonText:{color:'#fff',fontSize:16,fontWeight:'800'},
  metric:{flex:1,alignItems:'center'},
  metricValue:{fontSize:24,fontWeight:'900',color:colors.brown},
  metricLabel:{fontSize:12,color:colors.muted,textAlign:'center',marginTop:4},
  empty:{color:colors.muted,textAlign:'center',lineHeight:20},
});

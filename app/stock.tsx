import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Image,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {AppModal,Field,ModalButton} from '@/components/Forms';
import {Card,EmptyState,PrimaryButton} from '@/components/ui';
import {useApp} from '@/context/AppContext';
import {daysUntil,formatDate} from '@/lib/date';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';
import {bestProductNameFromText,detectBarcode,DetectedStockItem,parseReceiptText,runOcr} from '@/lib/photoImport';

type Item={id:string;custom_name:string|null;quantity:number;unit:string|null;location:string;expiry_date:string|null;low_stock_threshold:number|null;products?:{name:string}|null};
type PhotoMode='product'|'receipt'|null;

export default function Stock(){
  const{householdId}=useApp();
  const[items,setItems]=useState<Item[]>([]);const[loading,setLoading]=useState(false);const[modal,setModal]=useState(false);
  const[name,setName]=useState('');const[qty,setQty]=useState('1');const[unit,setUnit]=useState('unité');const[location,setLocation]=useState('pantry');const[expiry,setExpiry]=useState('');const[threshold,setThreshold]=useState('');
  const[photoMode,setPhotoMode]=useState<PhotoMode>(null);const[photoUri,setPhotoUri]=useState<string|null>(null);const[analyzing,setAnalyzing]=useState(false);const[progress,setProgress]=useState(0);const[detected,setDetected]=useState<DetectedStockItem[]>([]);const[analysisMessage,setAnalysisMessage]=useState('');

  const load=useCallback(async()=>{if(!householdId)return;setLoading(true);const{data,error}=await supabase.from('inventory_items').select('id,custom_name,quantity,unit,location,expiry_date,low_stock_threshold,products(name)').eq('household_id',householdId).order('expiry_date',{ascending:true,nullsFirst:false});if(error)console.error(error);else setItems((data||[]) as any);setLoading(false)},[householdId]);
  useEffect(()=>{load()},[load]);

  async function add(){if(!householdId||!name.trim())return;const{error}=await supabase.from('inventory_items').insert({household_id:householdId,custom_name:name.trim(),quantity:Number(qty)||1,unit:unit||null,location,expiry_date:expiry||null,low_stock_threshold:threshold?Number(threshold):null});if(error)alert(error.message);else{setName('');setQty('1');setExpiry('');setThreshold('');setModal(false);load()}}
  async function remove(id:string){if(!confirm('Supprimer ce produit du stock ?'))return;const{error}=await supabase.from('inventory_items').delete().eq('id',id);if(error)alert(error.message);else load()}

  function resetPhoto(){setPhotoMode(null);setPhotoUri(null);setDetected([]);setProgress(0);setAnalysisMessage('');setAnalyzing(false)}
  async function choosePhoto(mode:'product'|'receipt',camera=false){
    setPhotoMode(mode);setDetected([]);setAnalysisMessage('');setProgress(0);
    if(camera){const perm=await ImagePicker.requestCameraPermissionsAsync();if(!perm.granted){alert('Autorisez la caméra pour photographier le produit ou le ticket.');return}}
    const result=camera?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:.8}):await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.8});
    if(result.canceled||!result.assets?.[0]?.uri)return;
    const uri=result.assets[0].uri;setPhotoUri(uri);await analyzePhoto(mode,uri);
  }
  async function analyzePhoto(mode:'product'|'receipt',uri:string){
    setAnalyzing(true);setProgress(0);setAnalysisMessage(mode==='receipt'?'Lecture du ticket…':'Lecture du produit…');
    try{
      if(mode==='product'){
        const [barcode,text]=await Promise.all([detectBarcode(uri),runOcr(uri,setProgress)]);
        let knownName:string|null=null;
        if(barcode){const{data}=await supabase.from('products').select('name').eq('barcode',barcode).maybeSingle();knownName=data?.name||null}
        const productName=knownName||bestProductNameFromText(text);
        setDetected([{id:`p-${Date.now()}`,name:productName,quantity:'1',unit:'unité',barcode:barcode||undefined,confidence:knownName?.length?1:.7}]);
        setAnalysisMessage(barcode?`Code-barres détecté : ${barcode}. Vérifiez le produit avant validation.`:'Texte de l’emballage analysé. Vérifiez le nom avant validation.');
      }else{
        const text=await runOcr(uri,setProgress);const found=parseReceiptText(text);setDetected(found);
        setAnalysisMessage(found.length?`${found.length} ligne${found.length>1?'s':''} de produit détectée${found.length>1?'s':''}. Corrigez ou retirez les erreurs avant validation.`:'Aucun produit fiable détecté. Essayez une photo plus nette, cadrée uniquement sur le ticket.');
      }
    }catch(e:any){console.error(e);setAnalysisMessage(`Analyse impossible : ${e?.message||'erreur inconnue'}. Vous pouvez réessayer avec une photo plus nette.`)}finally{setAnalyzing(false)}
  }
  function updateDetected(id:string,field:'name'|'quantity'|'unit',value:string){setDetected(xs=>xs.map(x=>x.id===id?{...x,[field]:value}:x))}
  function dismissDetected(id:string){setDetected(xs=>xs.filter(x=>x.id!==id))}
  async function addDetectedToStock(){
    if(!householdId)return;const valid=detected.filter(x=>x.name.trim());if(!valid.length)return;
    const rows=valid.map(x=>({household_id:householdId,custom_name:x.name.trim(),quantity:Number(String(x.quantity).replace(',','.'))||1,unit:x.unit||'unité',location:'pantry'}));
    const{error}=await supabase.from('inventory_items').insert(rows);if(error){alert(error.message);return}resetPhoto();await load();
  }
  const photoTitle=photoMode==='receipt'?'Ajouter depuis un ticket':'Ajouter depuis une photo produit';
  const pct=Math.round(progress*100);
  const canValidate=useMemo(()=>detected.some(x=>x.name.trim()),[detected]);

  return <SafeAreaView style={s.safe}><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>} contentContainerStyle={s.c}>
    <Text style={s.h}>Stock</Text><Text style={s.p}>Ajoutez vos produits manuellement, en photographiant un article ou en important un ticket de caisse.</Text>
    <PrimaryButton label="Ajouter un produit manuellement" onPress={()=>setModal(true)}/>
    <View style={s.photoActions}><Pressable style={s.photoBtn} onPress={()=>choosePhoto('product',true)}><Text style={s.photoIcon}>📷</Text><Text style={s.photoBtnTitle}>Photographier un article</Text><Text style={s.photoBtnText}>Mijoty tente de lire le code-barres et l’étiquette.</Text></Pressable><Pressable style={s.photoBtn} onPress={()=>choosePhoto('receipt',true)}><Text style={s.photoIcon}>🧾</Text><Text style={s.photoBtnTitle}>Photographier un ticket</Text><Text style={s.photoBtnText}>Mijoty extrait les produits puis vous demande de les valider.</Text></Pressable></View>
    <View style={s.importRow}><Pressable onPress={()=>choosePhoto('product',false)}><Text style={s.importLink}>Importer une photo d’article</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={()=>choosePhoto('receipt',false)}><Text style={s.importLink}>Importer un ticket</Text></Pressable></View>
    {items.length===0&&<View style={{marginTop:12}}><EmptyState>Votre stock est vide. Ajoutez votre premier produit.</EmptyState></View>}
    {items.map(x=>{const d=daysUntil(x.expiry_date);const low=x.low_stock_threshold!=null&&Number(x.quantity)<=Number(x.low_stock_threshold);const nm=x.products?.name||x.custom_name||'Produit';return <Card key={x.id} style={{marginTop:10}}><View style={s.row}><View style={{flex:1}}><Text style={s.name}>{nm}</Text><Text style={s.meta}>{Number(x.quantity)} {x.unit||''} · {x.location}</Text><Text style={s.meta}>Péremption : {formatDate(x.expiry_date)}</Text></View><View style={{alignItems:'flex-end'}}>{d!=null&&<Text style={[s.exp,d<=7&&{color:colors.red}]}>{d<0?'dépassé':d===0?'aujourd’hui':`${d} j`}</Text>}{low&&<Text style={s.low}>stock faible</Text>}<Pressable onPress={()=>remove(x.id)}><Text style={s.delete}>Supprimer</Text></Pressable></View></View></Card>})}
  </ScrollView>

  <AppModal visible={modal} title="Ajouter au stock" onClose={()=>setModal(false)}><Field label="Produit" value={name} onChangeText={setName} placeholder="Ex. Yaourts"/><Field label="Quantité" value={qty} onChangeText={setQty} keyboardType="decimal-pad"/><Field label="Unité" value={unit} onChangeText={setUnit} placeholder="g, kg, L, unité..."/><Field label="Emplacement" value={location} onChangeText={setLocation} placeholder="fridge / freezer / pantry / other"/><Field label="Date de péremption (AAAA-MM-JJ)" value={expiry} onChangeText={setExpiry}/><Field label="Seuil stock faible" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad"/><ModalButton label="Ajouter" onPress={add}/></AppModal>

  <AppModal visible={!!photoMode} title={photoTitle} onClose={resetPhoto}>
    {photoUri&&<Image source={{uri:photoUri}} style={s.preview} resizeMode="contain"/>}
    {analyzing&&<View style={s.analysis}><ActivityIndicator/><Text style={s.analysisText}>{analysisMessage} {pct>0?`${pct}%`:''}</Text></View>}
    {!analyzing&&!!analysisMessage&&<Text style={s.message}>{analysisMessage}</Text>}
    {!analyzing&&detected.map((x,i)=><Card key={x.id} style={{marginBottom:10}}><View style={s.detectHead}><Text style={s.detectNum}>{photoMode==='receipt'?`Produit ${i+1}`:'Produit détecté'}</Text><Pressable onPress={()=>dismissDetected(x.id)}><Text style={s.delete}>Retirer</Text></Pressable></View><Field label="Nom" value={x.name} onChangeText={v=>updateDetected(x.id,'name',v)}/><View style={s.two}><View style={{flex:1}}><Field label="Quantité" value={x.quantity} onChangeText={v=>updateDetected(x.id,'quantity',v)} keyboardType="decimal-pad"/></View><View style={{flex:1}}><Field label="Unité" value={x.unit} onChangeText={v=>updateDetected(x.id,'unit',v)}/></View></View>{x.barcode&&<Text style={s.barcode}>Code-barres : {x.barcode}</Text>}</Card>)}
    {!analyzing&&canValidate&&<ModalButton label={detected.length>1?`Ajouter ${detected.length} produits au stock`:'Ajouter au stock'} onPress={addDetectedToStock}/>} 
    {!analyzing&&photoUri&&<ModalButton secondary label="Reprendre / choisir une autre photo" onPress={()=>choosePhoto(photoMode||'product',false)}/>} 
  </AppModal>
  </SafeAreaView>
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.cream},c:{padding:18,maxWidth:900,width:'100%',alignSelf:'center'},h:{fontSize:30,fontWeight:'900',color:colors.brown},p:{color:colors.muted,marginTop:6,marginBottom:16},row:{flexDirection:'row',justifyContent:'space-between',gap:12},name:{fontSize:16,fontWeight:'800',color:colors.brown},meta:{marginTop:5,color:colors.muted},exp:{fontWeight:'800',color:colors.sage},low:{fontSize:11,color:colors.honey,marginTop:4,fontWeight:'800'},delete:{fontSize:12,color:colors.red,marginTop:10,fontWeight:'800'},photoActions:{flexDirection:'row',gap:10,marginTop:10,flexWrap:'wrap'},photoBtn:{flexGrow:1,flexBasis:260,borderWidth:1,borderColor:colors.border,backgroundColor:colors.white,borderRadius:18,padding:14},photoIcon:{fontSize:24},photoBtnTitle:{fontWeight:'900',color:colors.brown,fontSize:15,marginTop:5},photoBtnText:{color:colors.muted,fontSize:12,marginTop:4,lineHeight:17},importRow:{flexDirection:'row',gap:8,justifyContent:'center',marginTop:12,marginBottom:2,flexWrap:'wrap'},importLink:{color:colors.terracotta,fontWeight:'800',fontSize:12},dot:{color:colors.muted},preview:{height:220,width:'100%',backgroundColor:'#fff',borderRadius:14,marginBottom:12},analysis:{padding:16,alignItems:'center',gap:8},analysisText:{color:colors.muted,textAlign:'center'},message:{color:colors.brown,backgroundColor:'#fff',borderRadius:12,padding:12,marginBottom:12,lineHeight:19},detectHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},detectNum:{fontWeight:'900',color:colors.brown,marginBottom:8},two:{flexDirection:'row',gap:10},barcode:{fontSize:12,color:colors.muted,marginTop:-2,marginBottom:4}})

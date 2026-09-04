import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Image,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {AppModal,Field,ModalButton} from '@/components/Forms';
import {AppHeader,Card,EmptyState,PrimaryButton} from '@/components/ui';
import {BarcodeScanner} from '@/components/BarcodeScanner';
import {useApp} from '@/context/AppContext';
import {daysUntil,formatDate} from '@/lib/date';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';
import {bestProductNameFromText,detectBarcode,DetectedStockItem,extractReceiptMeta,lookupBarcode,lookupProductByText,parseReceiptText,runOcr} from '@/lib/photoImport';

type Item={id:string;custom_name:string|null;quantity:number;unit:string|null;location:string;expiry_date:string|null;low_stock_threshold:number|null;products?:{name:string}|null};
type PhotoMode='product'|'receipt'|null;

export default function Stock(){
  const{householdId}=useApp();
  const[items,setItems]=useState<Item[]>([]);const[loading,setLoading]=useState(false);const[modal,setModal]=useState(false);
  const[name,setName]=useState('');const[qty,setQty]=useState('1');const[unit,setUnit]=useState('unité');const[location,setLocation]=useState('pantry');const[expiry,setExpiry]=useState('');const[threshold,setThreshold]=useState('');
  const[photoMode,setPhotoMode]=useState<PhotoMode>(null);const[scannerOpen,setScannerOpen]=useState(false);const[manualBarcode,setManualBarcode]=useState('');const[photoUri,setPhotoUri]=useState<string|null>(null);const[analyzing,setAnalyzing]=useState(false);const[progress,setProgress]=useState(0);const[detected,setDetected]=useState<DetectedStockItem[]>([]);const[analysisMessage,setAnalysisMessage]=useState('');const[receiptStore,setReceiptStore]=useState('');const[receiptDate,setReceiptDate]=useState('');const[receiptTotal,setReceiptTotal]=useState('');

  const load=useCallback(async()=>{if(!householdId)return;setLoading(true);const{data,error}=await supabase.from('inventory_items').select('id,custom_name,quantity,unit,location,expiry_date,low_stock_threshold,products(name)').eq('household_id',householdId).order('expiry_date',{ascending:true,nullsFirst:false});if(error)console.error(error);else setItems((data||[]) as any);setLoading(false)},[householdId]);
  useEffect(()=>{load()},[load]);

  async function add(){if(!householdId||!name.trim())return;const{error}=await supabase.from('inventory_items').insert({household_id:householdId,custom_name:name.trim(),quantity:Number(qty)||1,unit:unit||null,location,expiry_date:expiry||null,low_stock_threshold:threshold?Number(threshold):null});if(error)alert(error.message);else{setName('');setQty('1');setExpiry('');setThreshold('');setModal(false);load()}}
  async function remove(id:string){if(!confirm('Supprimer ce produit du stock ?'))return;const{error}=await supabase.from('inventory_items').delete().eq('id',id);if(error)alert(error.message);else load()}


  async function resolveBarcode(code:string){
    const barcode=code.replace(/\D/g,'');if(!barcode)return;
    setScannerOpen(false);setPhotoMode('product');setPhotoUri(null);setDetected([]);setAnalyzing(true);setAnalysisMessage(`Recherche du produit ${barcode}…`);
    try{
      const{data:known}=await supabase.from('products').select('name,brand,category,default_unit').eq('barcode',barcode).maybeSingle();
      const catalog=known?.name?null:await lookupBarcode(barcode);
      const productName=known?.name||catalog?.name||'Produit non référencé';
      setDetected([{id:`scan-${Date.now()}`,name:productName,quantity:catalog?.quantity||'1',unit:known?.default_unit||catalog?.unit||'unité',barcode,brand:known?.brand||catalog?.brand,category:known?.category||catalog?.category,imageUrl:catalog?.imageUrl,source:known?.name?'Catalogue Mijoty':catalog?.name?'Open Food Facts':'Code-barres',confidence:known?.name?1:catalog?.name?0.96:0.4}]);
      if(known?.name)setAnalysisMessage('Produit reconnu dans le catalogue Mijoty. Vérifiez puis ajoutez-le au stock.');
      else if(catalog?.name)setAnalysisMessage('Produit reconnu dans Open Food Facts. Vérifiez puis ajoutez-le au stock.');
      else setAnalysisMessage(`Le code-barres ${barcode} a bien été lu, mais ce produit n’est pas encore référencé dans Open Food Facts. Complétez son nom avant validation.`);
    }catch(e:any){console.error(e);setAnalysisMessage(`Code-barres ${barcode} détecté, mais la recherche produit a échoué. Vous pouvez compléter le nom manuellement.`);setDetected([{id:`scan-${Date.now()}`,name:'',quantity:'1',unit:'unité',barcode,source:'Code-barres'}])}
    finally{setAnalyzing(false)}
  }
  function submitManualBarcode(){const code=manualBarcode.replace(/\D/g,'');if(code.length<8){alert('Saisissez un code-barres valide (EAN/UPC).');return}setManualBarcode('');resolveBarcode(code)}

  function resetPhoto(){setPhotoMode(null);setPhotoUri(null);setDetected([]);setProgress(0);setAnalysisMessage('');setReceiptStore('');setReceiptDate('');setReceiptTotal('');setAnalyzing(false)}
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
        const ocrName=bestProductNameFromText(text);
        let known:any=null;let catalog:any=null;let textCatalog:any=null;
        if(barcode){const{data}=await supabase.from('products').select('name,brand,category,default_unit').eq('barcode',barcode).maybeSingle();known=data;if(!known?.name)catalog=await lookupBarcode(barcode)}
        if(!known?.name&&!catalog?.name&&ocrName&&ocrName!=='Produit détecté')textCatalog=await lookupProductByText(ocrName);
        const resolved=catalog?.name?catalog:textCatalog;
        const finalBarcode=barcode||textCatalog?.barcode||undefined;
        const productName=known?.name||resolved?.name||ocrName;
        setDetected([{id:`p-${Date.now()}`,name:productName,quantity:resolved?.quantity||'1',unit:known?.default_unit||resolved?.unit||'unité',barcode:finalBarcode,brand:known?.brand||resolved?.brand,category:known?.category||resolved?.category,imageUrl:resolved?.imageUrl,source:known?.name?'Catalogue Mijoty':resolved?.source,confidence:known?.name?1:catalog?.name?0.96:textCatalog?.name?0.88:0.7}]);
        if(known?.name)setAnalysisMessage(`Produit reconnu dans le catalogue Mijoty (${barcode}).`);
        else if(catalog?.name)setAnalysisMessage(`Produit reconnu via son code-barres dans Open Food Facts (${barcode}). Vérifiez avant validation.`);
        else if(textCatalog?.name)setAnalysisMessage(`Code-barres non exploitable, mais Mijoty a trouvé une correspondance Open Food Facts à partir de l’étiquette : « ${textCatalog.name} ». Vérifiez avant validation.`);
        else if(barcode)setAnalysisMessage(`Code-barres ${barcode} détecté mais produit non trouvé. Le nom proposé vient de l’étiquette : vérifiez-le avant validation.`);
        else setAnalysisMessage('Aucun code-barres lisible et aucune correspondance fiable trouvée dans Open Food Facts. Mijoty utilise le texte visible sur l’emballage : vérifiez le nom avant validation.');
      }else{
        const text=await runOcr(uri,setProgress);const found=parseReceiptText(text);const meta=extractReceiptMeta(text);setDetected(found);setReceiptStore(meta.storeName);setReceiptDate(meta.date);setReceiptTotal(meta.total!=null?String(meta.total.toFixed(2)):String(found.reduce((a,x)=>a+(x.price||0),0).toFixed(2)));
        setAnalysisMessage(found.length?`${found.length} ligne${found.length>1?'s':''} de produit détectée${found.length>1?'s':''}. Corrigez ou retirez les erreurs avant validation.`:'Aucun produit fiable détecté. Essayez une photo plus nette, cadrée uniquement sur le ticket.');
      }
    }catch(e:any){console.error(e);setAnalysisMessage(`Analyse impossible : ${e?.message||'erreur inconnue'}. Vous pouvez réessayer avec une photo plus nette.`)}finally{setAnalyzing(false)}
  }
  function updateDetected(id:string,field:'name'|'quantity'|'unit',value:string){setDetected(xs=>xs.map(x=>x.id===id?{...x,[field]:value}:x))}
  function dismissDetected(id:string){setDetected(xs=>xs.filter(x=>x.id!==id))}
  async function addDetectedToStock(){
    if(!householdId)return;const valid=detected.filter(x=>x.name.trim());if(!valid.length)return;
    const rows=[] as any[];
    for(const x of valid){
      let productId:string|null=null;
      if(x.barcode){
        const payload={barcode:x.barcode,name:x.name.trim(),brand:x.brand||null,category:x.category||null,default_unit:x.unit||'unité'};
        const{data:product,error:productError}=await supabase.from('products').upsert(payload,{onConflict:'barcode'}).select('id').single();
        if(!productError&&product?.id)productId=product.id;
      }
      rows.push({household_id:householdId,product_id:productId,custom_name:productId?null:x.name.trim(),quantity:Number(String(x.quantity).replace(',','.'))||1,unit:x.unit||'unité',location:'pantry'});
    }
    const{error}=await supabase.from('inventory_items').insert(rows);if(error){alert(error.message);return}
    if(photoMode==='receipt'&&Number(String(receiptTotal).replace(',','.'))>0){const{error:expenseError}=await supabase.from('expenses').insert({household_id:householdId,expense_date:receiptDate||new Date().toISOString().slice(0,10),store_name:receiptStore.trim()||null,amount:Number(String(receiptTotal).replace(',','.')),category:'groceries'});if(expenseError){alert(`Stock ajouté, mais la dépense n’a pas pu être enregistrée : ${expenseError.message}`);return}}
    resetPhoto();await load();
  }
  const photoTitle=photoMode==='receipt'?'Ajouter depuis un ticket':'Ajouter depuis une photo produit';
  const pct=Math.round(progress*100);
  const canValidate=useMemo(()=>detected.some(x=>x.name.trim()),[detected]);

  return <SafeAreaView style={s.safe}><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>} contentContainerStyle={s.c}>
    <AppHeader title="Stock" subtitle="Scannez un code-barres pour reconnaître instantanément un produit, ou ajoutez vos achats depuis un ticket."/>
    <PrimaryButton label="Ajouter un produit manuellement" onPress={()=>setModal(true)}/>
    <Pressable style={s.scanHero} onPress={()=>setScannerOpen(true)}><Text style={s.scanHeroIcon}>▥</Text><View style={{flex:1}}><Text style={s.scanHeroTitle}>Scanner un code-barres</Text><Text style={s.scanHeroText}>Visez le code avec la caméra. Mijoty reconnaît automatiquement le produit et vous demande de confirmer.</Text></View><Text style={s.scanArrow}>›</Text></Pressable>
    <View style={s.photoActions}><Pressable style={s.photoBtn} onPress={()=>choosePhoto('receipt',true)}><Text style={s.photoIcon}>🧾</Text><Text style={s.photoBtnTitle}>Scanner un ticket</Text><Text style={s.photoBtnText}>Ajoutez plusieurs produits et la dépense à partir d’un ticket.</Text></Pressable><Pressable style={s.photoBtn} onPress={()=>setModal(true)}><Text style={s.photoIcon}>✍️</Text><Text style={s.photoBtnTitle}>Ajout manuel</Text><Text style={s.photoBtnText}>Pour un produit sans code-barres ou non référencé.</Text></Pressable></View>
    <View style={s.importRow}><Pressable onPress={()=>choosePhoto('product',false)}><Text style={s.importLink}>Reconnaître depuis une photo</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={()=>choosePhoto('receipt',false)}><Text style={s.importLink}>Importer un ticket</Text></Pressable></View>
    {items.length===0&&<View style={{marginTop:12}}><EmptyState>Votre stock est vide. Ajoutez votre premier produit.</EmptyState></View>}
    {items.map(x=>{const d=daysUntil(x.expiry_date);const low=x.low_stock_threshold!=null&&Number(x.quantity)<=Number(x.low_stock_threshold);const nm=x.products?.name||x.custom_name||'Produit';return <Card key={x.id} style={{marginTop:10}}><View style={s.row}><View style={{flex:1}}><Text style={s.name}>{nm}</Text><Text style={s.meta}>{Number(x.quantity)} {x.unit||''} · {x.location}</Text><Text style={s.meta}>Péremption : {formatDate(x.expiry_date)}</Text></View><View style={{alignItems:'flex-end'}}>{d!=null&&<Text style={[s.exp,d<=7&&{color:colors.red}]}>{d<0?'dépassé':d===0?'aujourd’hui':`${d} j`}</Text>}{low&&<Text style={s.low}>stock faible</Text>}<Pressable onPress={()=>remove(x.id)}><Text style={s.delete}>Supprimer</Text></Pressable></View></View></Card>})}
  </ScrollView>

  <AppModal visible={scannerOpen} title="Scanner un code-barres" onClose={()=>setScannerOpen(false)}><BarcodeScanner active={scannerOpen} onDetected={resolveBarcode} onCancel={()=>setScannerOpen(false)}/><View style={s.manualCode}><Text style={s.manualCodeLabel}>Ou saisir le code-barres</Text><Field label="EAN / UPC" value={manualBarcode} onChangeText={setManualBarcode} keyboardType="numeric" placeholder="Ex. 3017620422003"/><ModalButton secondary label="Rechercher ce code" onPress={submitManualBarcode}/></View></AppModal>

  <AppModal visible={modal} title="Ajouter au stock" onClose={()=>setModal(false)}><Field label="Produit" value={name} onChangeText={setName} placeholder="Ex. Yaourts"/><Field label="Quantité" value={qty} onChangeText={setQty} keyboardType="decimal-pad"/><Field label="Unité" value={unit} onChangeText={setUnit} placeholder="g, kg, L, unité..."/><Field label="Emplacement" value={location} onChangeText={setLocation} placeholder="fridge / freezer / pantry / other"/><Field label="Date de péremption (AAAA-MM-JJ)" value={expiry} onChangeText={setExpiry}/><Field label="Seuil stock faible" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad"/><ModalButton label="Ajouter" onPress={add}/></AppModal>

  <AppModal visible={!!photoMode} title={photoTitle} onClose={resetPhoto}>
    {photoUri&&<Image source={{uri:photoUri}} style={s.preview} resizeMode="contain"/>}
    {analyzing&&<View style={s.analysis}><ActivityIndicator/><Text style={s.analysisText}>{analysisMessage} {pct>0?`${pct}%`:''}</Text></View>}
    {!analyzing&&!!analysisMessage&&<Text style={s.message}>{analysisMessage}</Text>}
    {!analyzing&&photoMode==='receipt'&&<Card style={{marginBottom:10}}><Text style={s.detectNum}>Informations du ticket</Text><Field label="Enseigne" value={receiptStore} onChangeText={setReceiptStore} placeholder="Ex. Carrefour"/><View style={s.two}><View style={{flex:1}}><Field label="Date (AAAA-MM-JJ)" value={receiptDate} onChangeText={setReceiptDate}/></View><View style={{flex:1}}><Field label="Total (€)" value={receiptTotal} onChangeText={setReceiptTotal} keyboardType="decimal-pad"/></View></View><Text style={s.barcode}>Le total validé sera aussi enregistré dans le budget courses.</Text></Card>}
    {!analyzing&&detected.map((x,i)=><Card key={x.id} style={{marginBottom:10}}><View style={s.detectHead}><Text style={s.detectNum}>{photoMode==='receipt'?`Produit ${i+1}`:'Produit détecté'}</Text><Pressable onPress={()=>dismissDetected(x.id)}><Text style={s.delete}>Retirer</Text></Pressable></View><Field label="Nom" value={x.name} onChangeText={v=>updateDetected(x.id,'name',v)}/><View style={s.two}><View style={{flex:1}}><Field label="Quantité" value={x.quantity} onChangeText={v=>updateDetected(x.id,'quantity',v)} keyboardType="decimal-pad"/></View><View style={{flex:1}}><Field label="Unité" value={x.unit} onChangeText={v=>updateDetected(x.id,'unit',v)}/></View></View>{x.imageUrl&&<Image source={{uri:x.imageUrl}} style={s.catalogImage} resizeMode="contain"/>}{x.barcode&&<Text style={s.barcode}>Code-barres : {x.barcode}</Text>}{x.brand&&<Text style={s.barcode}>Marque : {x.brand}</Text>}{x.category&&<Text style={s.barcode}>Catégorie : {x.category}</Text>}{x.source&&<Text style={s.source}>Source : {x.source}</Text>}{x.price!=null&&<Text style={s.barcode}>Prix détecté : {x.price.toFixed(2)} €</Text>}</Card>)}
    {!analyzing&&canValidate&&<ModalButton label={detected.length>1?`Ajouter ${detected.length} produits au stock`:'Ajouter au stock'} onPress={addDetectedToStock}/>} 
    {!analyzing&&photoUri&&<ModalButton secondary label="Reprendre / choisir une autre photo" onPress={()=>choosePhoto(photoMode||'product',false)}/>} 
  </AppModal>
  </SafeAreaView>
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.cream},c:{padding:18,maxWidth:900,width:'100%',alignSelf:'center'},h:{fontSize:30,fontWeight:'900',color:colors.brown},p:{color:colors.muted,marginTop:6,marginBottom:16},row:{flexDirection:'row',justifyContent:'space-between',gap:12},name:{fontSize:16,fontWeight:'800',color:colors.brown},meta:{marginTop:5,color:colors.muted},exp:{fontWeight:'800',color:colors.sage},low:{fontSize:11,color:colors.honey,marginTop:4,fontWeight:'800'},delete:{fontSize:12,color:colors.red,marginTop:10,fontWeight:'800'},photoActions:{flexDirection:'row',gap:10,marginTop:10,flexWrap:'wrap'},photoBtn:{flexGrow:1,flexBasis:260,borderWidth:1,borderColor:colors.border,backgroundColor:colors.white,borderRadius:18,padding:14},photoIcon:{fontSize:24},photoBtnTitle:{fontWeight:'900',color:colors.brown,fontSize:15,marginTop:5},photoBtnText:{color:colors.muted,fontSize:12,marginTop:4,lineHeight:17},importRow:{flexDirection:'row',gap:8,justifyContent:'center',marginTop:12,marginBottom:2,flexWrap:'wrap'},importLink:{color:colors.terracotta,fontWeight:'800',fontSize:12},dot:{color:colors.muted},preview:{height:220,width:'100%',backgroundColor:'#fff',borderRadius:14,marginBottom:12},analysis:{padding:16,alignItems:'center',gap:8},analysisText:{color:colors.muted,textAlign:'center'},message:{color:colors.brown,backgroundColor:'#fff',borderRadius:12,padding:12,marginBottom:12,lineHeight:19},detectHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},detectNum:{fontWeight:'900',color:colors.brown,marginBottom:8},two:{flexDirection:'row',gap:10},barcode:{fontSize:12,color:colors.muted,marginTop:-2,marginBottom:4},source:{fontSize:12,color:colors.sage,fontWeight:'800',marginBottom:4},catalogImage:{height:120,width:'100%',backgroundColor:'#fff',borderRadius:12,marginBottom:10},scanHero:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:colors.terracotta,borderRadius:20,padding:18,marginTop:2},scanHeroIcon:{fontSize:34,color:'#fff',fontWeight:'900'},scanHeroTitle:{fontSize:18,fontWeight:'900',color:'#fff'},scanHeroText:{fontSize:12,color:'#fff',opacity:.92,marginTop:4,lineHeight:17},scanArrow:{fontSize:36,color:'#fff',fontWeight:'300'},manualCode:{borderTopWidth:1,borderTopColor:colors.border,marginTop:8,paddingTop:14},manualCodeLabel:{fontWeight:'900',color:colors.brown,marginBottom:8,textAlign:'center'}})

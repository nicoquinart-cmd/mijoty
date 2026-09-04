import React,{useEffect,useRef,useState} from 'react';
import {Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '@/lib/theme';

export function BarcodeScanner({active,onDetected,onCancel}:{active:boolean;onDetected:(code:string)=>void;onCancel:()=>void}){
  const videoRef=useRef<any>(null);
  const controlsRef=useRef<any>(null);
  const doneRef=useRef(false);
  const[status,setStatus]=useState('Ouverture de la caméra…');

  useEffect(()=>{
    if(!active)return;
    doneRef.current=false;
    let mounted=true;
    (async()=>{
      if(Platform.OS!=='web'){
        setStatus('Le scan en direct est disponible dans la version web de Mijoty.');
        return;
      }
      try{
        const {BrowserMultiFormatReader}=await import('@zxing/browser');
        const reader=new BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:150,delayBetweenScanSuccess:500});
        setStatus('Placez le code-barres dans le cadre.');
        const controls=await reader.decodeFromConstraints(
          {video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},
          videoRef.current,
          (result:any)=>{
            const raw=result?.getText?.()||'';
            const code=String(raw).replace(/\D/g,'');
            if(!mounted||doneRef.current||code.length<8)return;
            doneRef.current=true;
            setStatus(`Code ${code} détecté.`);
            try{controlsRef.current?.stop?.()}catch{}
            onDetected(code);
          }
        );
        controlsRef.current=controls;
      }catch(e:any){
        console.error(e);
        const msg=String(e?.name||e?.message||'');
        if(/NotAllowed|Permission/i.test(msg))setStatus('Accès caméra refusé. Autorisez la caméra dans votre navigateur puis réessayez.');
        else if(/NotFound|DevicesNotFound/i.test(msg))setStatus('Aucune caméra disponible sur cet appareil.');
        else setStatus('Impossible d’ouvrir la caméra. Vous pouvez saisir le code-barres manuellement.');
      }
    })();
    return()=>{mounted=false;try{controlsRef.current?.stop?.()}catch{};controlsRef.current=null};
  },[active,onDetected]);

  if(!active)return null;
  return <View>
    <View style={s.cameraBox}>
      {Platform.OS==='web' ? React.createElement('video' as any,{ref:videoRef,style:{width:'100%',height:'100%',objectFit:'cover',background:'#111'},autoPlay:true,muted:true,playsInline:true}) : <View style={s.nativeFallback}><Text style={s.nativeText}>Caméra web requise</Text></View>}
      <View pointerEvents="none" style={s.frame}><View style={s.scanLine}/></View>
    </View>
    <Text style={s.status}>{status}</Text>
    <Pressable onPress={onCancel} style={s.cancel}><Text style={s.cancelText}>Annuler le scan</Text></Pressable>
  </View>
}

const s=StyleSheet.create({
  cameraBox:{height:340,borderRadius:18,overflow:'hidden',backgroundColor:'#111',position:'relative'},
  frame:{position:'absolute',left:'10%',right:'10%',top:'30%',bottom:'30%',borderWidth:3,borderColor:'#fff',borderRadius:14,justifyContent:'center'},
  scanLine:{height:2,backgroundColor:'#fff',opacity:.85,marginHorizontal:10},
  status:{textAlign:'center',color:colors.brown,fontWeight:'800',marginTop:12,lineHeight:20},
  cancel:{alignItems:'center',paddingVertical:12,marginTop:4},cancelText:{color:colors.terracotta,fontWeight:'900'},
  nativeFallback:{flex:1,alignItems:'center',justifyContent:'center'},nativeText:{color:'#fff',fontWeight:'800'}
});

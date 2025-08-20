import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, StatusBar, Share, SafeAreaView, Switch } from 'react-native';
import MapView, { Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { authFetch } from '../utils/authFetch';

const IP = '10.13.9.201';
const uteqCoords = { latitude: 20.592561, longitude: -100.392411 };

function haversine(lat1, lon1, lat2, lon2){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export default function AnalyticsScreen({ navigation }){
  const { theme } = useTheme();
  const { user } = useUser();
  const [data,setData] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  // Estado simplificado
  const [showHeatmap,setShowHeatmap] = useState(false);
  const [lastNDays,setLastNDays] = useState(30); // selector simple

  useEffect(()=>{ if(!user){ navigation.goBack(); return; } fetchData(); },[user]);

  const fetchData = async ()=>{
    setLoading(true); setError(null);
    try { const r = await authFetch(`http://${IP}:3000/reportes`); const d = await r.json(); if(r.ok && Array.isArray(d)) setData(d); else setError('No se pudo obtener'); } catch { setError('Error de red'); } finally { setLoading(false); }
  };

  const filteredData = useMemo(()=>{
    if(!data.length) return [];
    const from = new Date(); from.setHours(0,0,0,0); from.setDate(from.getDate() - (lastNDays-1));
    return data.filter(r=>{
      const fecha = new Date(r.fecha || r.fecha_creacion || r.created_at || r.date);
      if(isNaN(fecha)) return false;
      return fecha >= from;
    });
  },[data,lastNDays]);

  const stats = useMemo(()=>{
    const total = filteredData.length;
    // Estructura vacía coherente con la UI
    if(!total) return { total:0, avgPerDay:0, riskLabel:'-', countNivel:{rojo:0,amarillo:0,verde:0}, cerca:0, medio:0, lejos:0, bloques:{madrugada:0,manana:0,tarde:0,noche:0}, dias:[] };

    const countNivel = { rojo:0, amarillo:0, verde:0 };
    const distancias = [];
    const horas = Array.from({length:24},()=>0);

    // Últimos 7 días para mini barra
    const hoy = new Date();
    const dayMap = {};
    for(let i=6;i>=0;i--){ const d=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()-i); dayMap[d.toISOString().slice(0,10)]={ date:d, count:0 }; }

    filteredData.forEach(r=>{
      if(r.nivel && countNivel[r.nivel]!==undefined) countNivel[r.nivel]++;
      const lat=parseFloat(r.latitud), lon=parseFloat(r.longitud);
      if(!isNaN(lat)&&!isNaN(lon)) distancias.push(haversine(uteqCoords.latitude, uteqCoords.longitude, lat, lon));
      const f=new Date(r.fecha_creacion || r.created_at || r.fecha || r.date);
      if(!isNaN(f)){
        horas[f.getHours()]++;
        const k=f.toISOString().slice(0,10); if(dayMap[k]) dayMap[k].count++;
      }
    });

    // Promedio simple por día (ventana fija seleccionada)
    const avgPerDay = total / Math.max(1,lastNDays);

    // Riesgo simple ponderado
    const riskRaw = total? ( (3*countNivel.rojo + 2*countNivel.amarillo + 1*countNivel.verde)/(3*total) ):0;
    let riskLabel='Bajo'; if(riskRaw>=0.66) riskLabel='Alto'; else if(riskRaw>=0.33) riskLabel='Medio';

    // Clasificación distancia
    let cerca=0, medio=0, lejos=0;
    distancias.forEach(d=>{ if(d<150) cerca++; else if(d<400) medio++; else lejos++; });

    // Tramos del día
    const bloques={madrugada:0,manana:0,tarde:0,noche:0};
    horas.forEach((c,h)=>{ if(!c) return; if(h<6) bloques.madrugada+=c; else if(h<12) bloques.manana+=c; else if(h<18) bloques.tarde+=c; else bloques.noche+=c; });

    const dias = Object.keys(dayMap).sort().map(k=>{ const d=dayMap[k]; return { label:d.date.toLocaleDateString('es-MX',{day:'2-digit',month:'short'}), count:d.count }; });

    return { total, avgPerDay, riskLabel, countNivel, cerca, medio, lejos, bloques, dias };
  },[filteredData,lastNDays]);

  const exportCSV = async ()=>{
    try{
      if(!filteredData.length){ return; }
      const header=['id','nivel','latitud','longitud','fecha','usuario_correo','usuario_nombre'];
      const rows = filteredData.map(r=>[
        r.id||'', r.nivel||'', r.latitud||'', r.longitud||'', (r.fecha_creacion||r.created_at||'').toString(), r.usuario_correo||'', r.usuario_nombre||''
      ]);
      const csv = [header.join(','), ...rows.map(r=> r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
      await Share.share({ message: csv, title:'Export CSV' });
    }catch(e){ /* noop */ }
  };

  const color = theme.colors.text;
  const sub = theme.colors.textSecondary || '#64748b';

  if(loading) return <View style={[styles.center,{ backgroundColor: theme.colors.background }]}><ActivityIndicator color={theme.colors.primary} size="large" /><Text style={{color:sub, marginTop:10}}>Calculando...</Text></View>;
  if(error) return <View style={[styles.center,{ backgroundColor: theme.colors.background }]}><Text style={{color:'#dc2626', fontWeight:'700'}}>{error}</Text><TouchableOpacity onPress={fetchData} style={{marginTop:12, paddingHorizontal:16, paddingVertical:10, backgroundColor:theme.colors.primary, borderRadius:8}}><Text style={{color:'#fff', fontWeight:'600'}}>Reintentar</Text></TouchableOpacity></View>;

  return (
    <SafeAreaView style={{flex:1, backgroundColor: theme.colors.background}}>
    <ScrollView style={{flex:1}} contentContainerStyle={{padding:16, paddingBottom:40}}>
      <StatusBar barStyle={theme.dark?'light-content':'dark-content'} backgroundColor={theme.colors.background} />
  <Text style={{fontSize:22, fontWeight:'700', color:color, textAlign:'center', marginBottom:4}}>Resumen de Reportes</Text>
  <Text style={{fontSize:12, color:sub, textAlign:'center', marginBottom:16}}>Últimos {lastNDays} días (registros: {filteredData.length})</Text>
      {/* Selector simple de ventana temporal */}
      <View style={{flexDirection:'row', justifyContent:'center', marginBottom:12}}>
        {[7,30,90].map(n=> (
          <TouchableOpacity key={n} onPress={()=>setLastNDays(n)} style={{paddingHorizontal:14,paddingVertical:6, borderRadius:20, marginHorizontal:4, backgroundColor: lastNDays===n? theme.colors.primary: theme.colors.card, borderWidth:1, borderColor: theme.colors.border}}>
            <Text style={{color: lastNDays===n?'#fff': color, fontSize:12}}>{n} días</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={exportCSV} style={{paddingHorizontal:14,paddingVertical:6,borderRadius:20, marginLeft:4, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border}}>
          <Text style={{color, fontSize:12}}>CSV</Text>
        </TouchableOpacity>
      </View>
      <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:10}}>
        <Text style={{color:sub, fontSize:12, marginRight:8}}>Heatmap</Text>
        <Switch value={showHeatmap} onValueChange={setShowHeatmap} thumbColor={showHeatmap? '#db2777':'#ccc'} trackColor={{true:'#fda4af', false: theme.colors.border}} />
      </View>
      {/* Resumen simple */}
      <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
        <Text style={[styles.cardTitle,{color}]}>Resumen</Text>
        <Text style={[styles.simpleLine,{color:sub}]}><Text style={styles.simpleLabel}>Total:</Text> <Text style={styles.simpleValue}>{stats.total}</Text></Text>
        <Text style={[styles.simpleLine,{color:sub}]}><Text style={styles.simpleLabel}>Prom/día:</Text> <Text style={styles.simpleValue}>{stats.avgPerDay.toFixed(1)}</Text></Text>
        <Text style={[styles.simpleLine,{color:sub}]}><Text style={styles.simpleLabel}>Rojo:</Text> <Text style={{color:'#dc2626', fontWeight:'600'}}>{stats.countNivel.rojo}</Text>  <Text style={styles.simpleLabel}>Amarillo:</Text> <Text style={{color:'#f59e0b', fontWeight:'600'}}>{stats.countNivel.amarillo}</Text>  <Text style={styles.simpleLabel}>Verde:</Text> <Text style={{color:'#16a34a', fontWeight:'600'}}>{stats.countNivel.verde}</Text></Text>
    <Text style={[styles.simpleLine,{color:sub}]}><Text style={styles.simpleLabel}>Riesgo:</Text> <Text style={{color: stats.riskLabel==='Alto'?'#dc2626': stats.riskLabel==='Medio'?'#f59e0b':'#16a34a', fontWeight:'700'}}>{stats.riskLabel}</Text></Text>
      </View>
      {/* Distancias simplificadas */}
      <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
  <Text style={[styles.cardTitle,{color}]}>Ubicación</Text>
  <Text style={[styles.simpleLine,{color:sub}]}>Cerca: <Text style={styles.simpleValue}>{stats.cerca}</Text>  Medio: <Text style={styles.simpleValue}>{stats.medio}</Text>  Lejos: <Text style={styles.simpleValue}>{stats.lejos}</Text></Text>
      </View>
  {/* Momentos del día */}
      <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
  <Text style={[styles.cardTitle,{color}]}>Momentos del día</Text>
  <Text style={[styles.simpleLine,{color:sub}]}>Madrugada: <Text style={styles.simpleValue}>{stats.bloques.madrugada}</Text></Text>
  <Text style={[styles.simpleLine,{color:sub}]}>Mañana: <Text style={styles.simpleValue}>{stats.bloques.manana}</Text></Text>
  <Text style={[styles.simpleLine,{color:sub}]}>Tarde: <Text style={styles.simpleValue}>{stats.bloques.tarde}</Text></Text>
  <Text style={[styles.simpleLine,{color:sub}]}>Noche: <Text style={styles.simpleValue}>{stats.bloques.noche}</Text></Text>
      </View>
      <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
        <Text style={[styles.cardTitle,{color}]}>Últimos 7 días</Text>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
          {stats.dias.map(d=> (
            <View key={d.label} style={{alignItems:'center', flex:1}}>
              <Text style={{color:sub, fontSize:11}}>{d.label}</Text>
              <Text style={{color, fontWeight:'600'}}>{d.count}</Text>
            </View>
          ))}
        </View>
      </View>
  {/* Se elimina bloque de Poisson para simplificar */}
  {/* Se omite clusters para simplificar visualmente */}
      {showHeatmap && (
        <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
          <Text style={[styles.cardTitle,{color}]}>Heatmap</Text>
          {filteredData.length? (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{height:220, borderRadius:12}}
              initialRegion={{ latitude: uteqCoords.latitude, longitude: uteqCoords.longitude, latitudeDelta:0.008, longitudeDelta:0.008 }}
            >
              <Heatmap
                points={filteredData.filter(r=> !isNaN(parseFloat(r.latitud)) && !isNaN(parseFloat(r.longitud))).map(r=> ({ latitude: parseFloat(r.latitud), longitude: parseFloat(r.longitud), weight: 1 }))}
                radius={40}
                opacity={0.7}
                gradient={{
                  colors: ['#60a5fa','#2563eb','#1e3a8a'],
                  startPoints: [0.2,0.6,1.0],
                  colorMapSize: 256
                }}
              />
            </MapView>
          ) : <Text style={{color:sub, fontSize:12}}>Sin puntos para mostrar</Text>}
          <View style={{flexDirection:'row', justifyContent:'center', marginTop:8}}>
            <View style={styles.legendItem}><View style={[styles.legendColor,{backgroundColor:'#60a5fa'}]} /><Text style={styles.legendLabel}>Menos</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendColor,{backgroundColor:'#2563eb'}]} /><Text style={styles.legendLabel}>Medio</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendColor,{backgroundColor:'#1e3a8a'}]} /><Text style={styles.legendLabel}>Más</Text></View>
          </View>
        </View>
      )}
      <TouchableOpacity onPress={()=>navigation.goBack()} style={{alignSelf:'center', marginTop:10, paddingHorizontal:20, paddingVertical:12, backgroundColor:theme.colors.primary, borderRadius:12}}>
        <Text style={{color:'#fff', fontWeight:'700'}}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center:{ flex:1, justifyContent:'center', alignItems:'center' },
  card:{ borderWidth:1, borderRadius:16, padding:14, marginBottom:14 },
  cardTitle:{ fontSize:14, fontWeight:'700', letterSpacing:0.5, textTransform:'uppercase', marginBottom:8 },
  line:{ fontSize:12, marginBottom:4 },
  input:{ borderWidth:1, borderRadius:12, paddingHorizontal:10, paddingVertical:6, fontSize:12 },
  legendItem:{ flexDirection:'row', alignItems:'center', marginHorizontal:6 },
  legendColor:{ width:14, height:14, borderRadius:3, marginRight:4 },
  legendLabel:{ fontSize:10, fontWeight:'600', color:'#64748b' },
  simpleLine:{ fontSize:12, marginBottom:6 },
  simpleLabel:{ fontWeight:'600' },
  simpleValue:{ fontWeight:'600', color:'#0f172a' }
});

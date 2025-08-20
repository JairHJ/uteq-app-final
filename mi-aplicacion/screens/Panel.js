// Limpiado: archivo reemplazado con nueva implementación.
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Dimensions, ActivityIndicator, TextInput, Modal, StatusBar, Image, Platform, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch, setOnUnauthorized } from '../utils/authFetch';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const IP = '10.13.9.201';

function AlertEmailsInfoModal({ visible, onClose, emails }) {
  const { theme } = useTheme();
  if (!visible) return null;
  const dedupe = (arr=[]) => Array.from(new Set(arr.filter(Boolean)));
  const rojo = dedupe(emails?.rojo);
  const amarillo = dedupe(emails?.amarillo);
  const verde = dedupe(emails?.verde);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { padding: 24, backgroundColor: theme.colors.card }]}> 
          <Text style={[styles.modalTitle, { textAlign: 'center', color: theme.colors.text }]}>Destinatarios por nivel</Text>
          <Text style={[styles.modalSubtitle, { textAlign: 'center', marginBottom: 16, color: theme.colors.textSecondary }]}>Correos que reciben cada alerta</Text>
          <View style={{ marginBottom: 14, backgroundColor: '#fee2e2', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontWeight: 'bold', color: '#e53935', fontSize: 17, marginBottom: 4 }}>🔴 Nivel Rojo</Text>
            {rojo.length ? rojo.map((m,i) => <Text key={`${m}-${i}`} style={{ marginLeft: 12, color: '#b91c1c', fontSize: 15 }}>{m}</Text>) : <Text style={{ marginLeft: 12, color: '#e53935' }}>Sin destinatarios</Text>}
          </View>
          <View style={{ marginBottom: 14, backgroundColor: '#fef9c3', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: 17, marginBottom: 4 }}>🟡 Nivel Amarillo</Text>
            {amarillo.length ? amarillo.map((m,i) => <Text key={`${m}-${i}`} style={{ marginLeft: 12, color: '#b45309', fontSize: 15 }}>{m}</Text>) : <Text style={{ marginLeft: 12, color: '#f59e0b' }}>Sin destinatarios</Text>}
          </View>
          <View style={{ marginBottom: 10, backgroundColor: '#dcfce7', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 17, marginBottom: 4 }}>🟢 Nivel Verde</Text>
            {verde.length ? verde.map((m,i) => <Text key={`${m}-${i}`} style={{ marginLeft: 12, color: '#15803d', fontSize: 15 }}>{m}</Text>) : <Text style={{ marginLeft: 12, color: '#16a34a' }}>Sin destinatarios</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 8, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 22, backgroundColor: '#1e40af', borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Fórmulas matemáticas usadas:
// - Distancias: Haversine (aprox) para distancia entre dos coordenadas.
// - Porcentajes de cada nivel: (count / total) * 100.
// - Índice de riesgo: (3*R + 2*A + 1*V) / (3*total) normalizado [0,1].
// - Clasificación de riesgo según umbrales.
export default function Panel({ navigation }) {
  const { theme } = useTheme();
  const { logout, user } = useUser();
  const uteqCoords = { latitude: 20.592561, longitude: -100.392411 };
  const [userLocation, setUserLocation] = useState(null);
  const [accidentes, setAccidentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [descripcionAccidente, setDescripcionAccidente] = useState('');
  const [nivelAlerta, setNivelAlerta] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedAccidente, setSelectedAccidente] = useState(null);
  const [semaforoVisible, setSemaforoVisible] = useState(false);
  const [imagenUri, setImagenUri] = useState(null);
  const [modalImagenVisible, setModalImagenVisible] = useState(false);
  const [imagenGrandeUri, setImagenGrandeUri] = useState(null);
  const [alertEmails, setAlertEmails] = useState(null);
  const [alertEmailsModalVisible, setAlertEmailsModalVisible] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [selectNumberModalVisible, setSelectNumberModalVisible] = useState(false);

  useEffect(() => {
    const sub = navigation.addListener('focus', async () => {
      try {
        if(!user?.correo) return;
        const key = `phoneNumbers:${user.correo.toLowerCase()}`;
        let s = await AsyncStorage.getItem(key);
        if(!s){
          // Intentar migrar desde clave global
          const legacy = await AsyncStorage.getItem('phoneNumbers');
          if(legacy){ s = legacy; try { await AsyncStorage.setItem(key, legacy); await AsyncStorage.removeItem('phoneNumbers'); } catch {} }
        }
        if (s) {
          const p = JSON.parse(s);
          if (Array.isArray(p)) {
            const seen = new Set();
            const unique = [];
            for (const item of p) {
              if (item && item.number && !seen.has(item.number) && /^\d{10,15}$/.test(item.number)) {
                seen.add(item.number);
                unique.push({ number:item.number, alias:item.alias||'' });
                if(unique.length===3) break;
              }
            }
            setPhoneNumbers(unique);
          }
        } else setPhoneNumbers([]);
      } catch { }
    });
    return sub;
  }, [navigation, user]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } else {
          Alert.alert('Permiso denegado', 'Sin acceso a ubicación');
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
      await cargarAccidentes();
      await cargarAlertEmails();
    })();
  }, []);

  useEffect(()=>{ setOnUnauthorized(()=>{ Alert.alert('Sesión','Expirada, inicia de nuevo'); logout(); navigation.reset({index:0,routes:[{name:'Login'}]}); }); },[logout,navigation]);
  const cargarAccidentes = async () => { try { const r = await authFetch(`http://${IP}:3000/reportes`); const d = await r.json(); if(r.ok) setAccidentes(Array.isArray(d)?d:[]); } catch(e){ console.error(e);} };
  const cargarAlertEmails = async () => { try { const r = await authFetch(`http://${IP}:3000/alert-emails`); const d = await r.json(); if(r.ok) setAlertEmails(d); } catch(e){ console.error(e);} };
  const agregarAccidente = () => setSemaforoVisible(true);
  const tomarFoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso', 'Activa la cámara'); return; }
      const mediaType = ImagePicker.MediaType ? ImagePicker.MediaType.Image : ImagePicker.MediaTypeOptions.Images;
      const res = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, mediaTypes: mediaType });
      if (!res.canceled && res.assets?.length) {
        const asset = res.assets[0];
        // Validaciones
        if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) { Alert.alert('Imagen', 'Máximo 2 MB'); return; }
        const extOk = /\.(jpe?g|png)$/i.test(asset.uri);
        if (!extOk) { Alert.alert('Formato', 'Solo JPG o PNG'); return; }
        setImagenUri(asset.uri);
      }
    } catch (e) { console.error(e); }
  };
  const guardarAccidente = async () => { if (!userLocation) { Alert.alert('Ubicación', 'No disponible'); return; } if (!descripcionAccidente.trim()) { Alert.alert('Descripción', 'Ingresa una descripción'); return; } if (!nivelAlerta) { Alert.alert('Nivel', 'Selecciona nivel'); return; } try { const fd = new FormData(); fd.append('descripcion', descripcionAccidente.trim()); fd.append('latitud', userLocation.latitude.toString()); fd.append('longitud', userLocation.longitude.toString()); fd.append('nivel', nivelAlerta); if (imagenUri) { const filename = imagenUri.split('/').pop(); const ext = filename.split('.').pop(); const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'; fd.append('imagen', { uri: imagenUri, name: filename, type }); } const resp = await authFetch(`http://${IP}:3000/reportes`, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } }); const result = await resp.json(); if (resp.ok) { Alert.alert('Éxito', 'Accidente reportado'); setModalVisible(false); setDescripcionAccidente(''); setNivelAlerta(null); setImagenUri(null); await cargarAccidentes(); } else { Alert.alert('Error', result.message || 'Error al reportar'); } } catch (e) { Alert.alert('Error', 'No se pudo conectar'); console.error(e); } };
  const mostrarConfirmacionEliminar = a => { setSelectedAccidente(a); setDeleteModalVisible(true); };
  const eliminarAccidente = async () => { if (!selectedAccidente) return; try { const r = await authFetch(`http://${IP}:3000/reportes/${selectedAccidente.id}`, { method: 'DELETE' }); const d = await r.json(); if (r.ok) { Alert.alert('Éxito', 'Accidente eliminado'); setDeleteModalVisible(false); setSelectedAccidente(null); await cargarAccidentes(); } else { Alert.alert('Error', d.message || 'No se pudo eliminar'); } } catch (e) { Alert.alert('Error', 'No se pudo conectar'); console.error(e); } };
  const enviarWhatsapp = () => { if (!userLocation) { Alert.alert('Ubicación', 'No disponible'); return; } if (phoneNumbers.length === 0) { Alert.alert('Configura un número', 'Agrega números en Configuraciones.'); navigation.navigate('Configuraciones'); return; } if (phoneNumbers.length === 1) { openWhatsApp(phoneNumbers[0].number); } else setSelectNumberModalVisible(true); };
  const openWhatsApp = async (numero) => { if (!userLocation) return; const link = `https://www.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`; const mensaje = `¡Hola! Esta es mi ubicación actual: ${link}`; const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`; const ok = await Linking.canOpenURL(url); if (ok) await Linking.openURL(url); else Alert.alert('Error', 'No se pudo abrir WhatsApp'); setSelectNumberModalVisible(false); };
  // Cálculos matemáticos (memoizados) - debe ir ANTES de cualquier return condicional para no romper el orden de hooks
  const stats = useMemo(() => {
    const total = accidentes.length || 0;
    const rojo = accidentes.filter(a => a.nivel === 'rojo').length;
    const amarillo = accidentes.filter(a => a.nivel === 'amarillo').length;
    const verde = accidentes.filter(a => a.nivel === 'verde').length;
    const pct = (c) => total ? (c / total * 100).toFixed(0) : '0';
    const riskRaw = total ? ((3 * rojo + 2 * amarillo + 1 * verde) / (3 * total)) : 0;
    let riskLabel = 'Bajo';
    if (riskRaw >= 0.66) riskLabel = 'Alto'; else if (riskRaw >= 0.33) riskLabel = 'Medio';
    return { total, rojo, amarillo, verde, pctRojo: pct(rojo), pctAmarillo: pct(amarillo), pctVerde: pct(verde), riskRaw, riskLabel };
  }, [accidentes]);

  if (loading) { 
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1e40af" />
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Cargando mapa...</Text>
        </View>
      </View>
    ); 
  }

  function distanceToUser(accidente){
    if(!userLocation) return null;
    try { const lat1=userLocation.latitude, lon1=userLocation.longitude; const lat2=parseFloat(accidente.latitud), lon2=parseFloat(accidente.longitud); const R=6371000; const toRad=d=>d*Math.PI/180; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1); const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); const d=R*c; return d; } catch { return null; }
  }

  return (
  <SafeAreaView style={[styles.container,{ backgroundColor: theme.colors.background }]}> 
      <View style={{flex:1,paddingTop: Platform.OS === 'android' ? 4 : 0}}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AlertEmailsInfoModal visible={alertEmailsModalVisible} onClose={() => setAlertEmailsModalVisible(false)} emails={alertEmails} />
      <View style={styles.mapContainer}>
        <MapView style={styles.map} initialRegion={{ latitude: userLocation ? userLocation.latitude : uteqCoords.latitude, longitude: userLocation ? userLocation.longitude : uteqCoords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }} showsUserLocation showsMyLocationButton showsCompass>
          <Marker coordinate={uteqCoords} title="UTEQ" description="Universidad Tecnológica de Querétaro">
            <View style={styles.customMarkerUteq}><Text style={styles.markerText}>🏫</Text></View>
          </Marker>
          {accidentes.map(a => (
            <Marker key={a.id} coordinate={{ latitude: parseFloat(a.latitud), longitude: parseFloat(a.longitud) }} title={a.descripcion || 'Accidente'} description={(a.usuario_nombre?`Autor: ${a.usuario_nombre}\n`: a.usuario_correo?`Autor: ${a.usuario_correo}\n`:'') + (a.nivel?`Nivel: ${a.nivel}`:'')} onPress={() => mostrarConfirmacionEliminar(a)}>
              {a.imagen ? (
                <View style={[styles.customMarkerAccidente, { padding: 0, backgroundColor: 'white', borderWidth: 2, borderColor: '#ef4444' }]}> 
                  <Image source={{ uri: a.imagen.startsWith('http') ? a.imagen : `http://${IP}:3000/${a.imagen}` }} style={{ width: 36, height: 28, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444' }} />
                </View>
              ) : (
                <View style={styles.customMarkerAccidente}><Text style={styles.markerText}>⚠️</Text></View>
              )}
            </Marker>
          ))}
        </MapView>
        <View style={[styles.accidentCounter,{ backgroundColor: theme.colors.card, flexDirection:'row', alignItems:'center' }]}> 
          <Text style={[styles.counterText,{ color: theme.colors.text } ]}>📊 {accidentes.length} accidente{accidentes.length !== 1 ? 's' : ''} reportado{accidentes.length !== 1 ? 's' : ''}</Text>
          {(user?.rol === 'admin' || user?.rol==='gestor' || user?.rol==='superadmin') && (
            <TouchableOpacity onPress={()=>navigation.navigate('Analiticas')} style={{marginLeft:8, paddingHorizontal:10, paddingVertical:6, borderRadius:12, backgroundColor: theme.colors.primary}}>
              <Text style={{color:'#fff', fontSize:12, fontWeight:'600'}}>Analíticas</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
        { (user?.rol === 'admin' || user?.rol === 'gestor') && (
          <View style={[styles.statsBar,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
            <View style={styles.statItem}><Text style={[styles.statLabel,{color:theme.colors.textSecondary}]}>Total</Text><Text style={[styles.statValue,{color:theme.colors.text}]}>{stats.total}</Text></View>
            <View style={styles.statItem}><Text style={[styles.statLabel,{color:'#b91c1c'}]}>R ({stats.pctRojo}%)</Text><Text style={[styles.statValue,{color:'#dc2626'}]}>{stats.rojo}</Text></View>
            <View style={styles.statItem}><Text style={[styles.statLabel,{color:'#b45309'}]}>A ({stats.pctAmarillo}%)</Text><Text style={[styles.statValue,{color:'#f59e0b'}]}>{stats.amarillo}</Text></View>
            <View style={styles.statItem}><Text style={[styles.statLabel,{color:'#15803d'}]}>V ({stats.pctVerde}%)</Text><Text style={[styles.statValue,{color:'#16a34a'}]}>{stats.verde}</Text></View>
            <View style={styles.statItem}><Text style={[styles.statLabel,{color:theme.colors.textSecondary}]}>Riesgo</Text><Text style={[styles.statValue,{color: stats.riskLabel==='Alto'?'#dc2626': stats.riskLabel==='Medio'?'#f59e0b':'#16a34a'}]}>{stats.riskLabel}</Text></View>
          </View>
        )}
          {/* Botón de Analíticas movido junto al contador superior para roles permitidos */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={{ backgroundColor: '#2563eb', borderRadius: 15, paddingVertical: 12, alignItems: 'center' }} onPress={() => setAlertEmailsModalVisible(true)}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>¿A dónde se envía cada alerta?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={agregarAccidente}>
          <View style={styles.buttonContent}><Text style={styles.buttonIcon}>🚨</Text><Text style={styles.addButtonText}>Reportar Accidente</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.whatsappButton} onPress={enviarWhatsapp}>
          <View style={styles.buttonContent}><Text style={styles.buttonIcon}>📍</Text><Text style={styles.buttonText}>Enviar Ubicación</Text></View>
        </TouchableOpacity>
        {user && (
          <TouchableOpacity style={[styles.configOutlineButton,{ borderColor: theme.colors.border }]} onPress={() => navigation.navigate('Configuraciones')}>
            <View style={styles.buttonContent}><Text style={[styles.buttonIcon,{fontSize:18}]}>⚙️</Text><Text style={[styles.configOutlineText,{ color: theme.colors.text }]}>Configuraciones</Text></View>
          </TouchableOpacity>
        )}
        {user?.rol === 'superadmin' && (
          <TouchableOpacity style={[styles.configOutlineButton,{ borderColor: '#ef4444', marginTop:4 }]} onPress={()=>navigation.navigate('AdminUsuarios')}>
            <View style={styles.buttonContent}><Text style={[styles.buttonIcon,{fontSize:18}]}>🛠️</Text><Text style={[styles.configOutlineText,{ color: '#ef4444' }]}>Admin Usuarios</Text></View>
          </TouchableOpacity>
        )}
      </View>
      <Modal transparent animationType="fade" visible={semaforoVisible} onRequestClose={() => setSemaforoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 30 }]}> 
            <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>Selecciona el nivel de alerta</Text>
            <Text style={{ fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20 }}>¿Qué tan urgente es la situación?</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {['rojo', 'amarillo', 'verde'].map(c => (
                <TouchableOpacity key={c} onPress={() => { setNivelAlerta(c); setSemaforoVisible(false); setModalVisible(true); }} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: c === 'rojo' ? '#e53935' : c === 'amarillo' ? '#fbc02d' : '#43a047', marginBottom: 5, borderWidth: nivelAlerta === c ? 2 : 0, borderColor: '#333' }} />
                  <Text style={{ color: c === 'rojo' ? '#e53935' : c === 'amarillo' ? '#f59e0b' : '#16a34a', fontWeight: 'bold' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setSemaforoVisible(false)} style={{ marginTop: 20, alignSelf: 'center' }}><Text style={{ color: '#e53935', fontWeight: 'bold' }}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal transparent animationType="slide" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent,{ backgroundColor: theme.colors.card }] }>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🚨</Text>
              <Text style={[styles.modalTitle,{ color: theme.colors.text }]}>Reportar Accidente</Text>
              {nivelAlerta && <Text style={{ fontWeight: 'bold', color: nivelAlerta === 'rojo' ? '#e53935' : nivelAlerta === 'amarillo' ? '#fbc02d' : '#43a047', fontSize: 16, marginTop: 5 }}>Nivel: {nivelAlerta.charAt(0).toUpperCase() + nivelAlerta.slice(1)}</Text>}
              <Text style={[styles.modalSubtitle,{ color: theme.colors.textSecondary }]}>Describe lo que está sucediendo</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput style={[styles.textInput, { color: '#1e293b', backgroundColor: '#f3f6fb', borderColor: '#cbd5e1' }]} placeholder="Ej: Choque entre dos vehículos, hay heridos..." placeholderTextColor="#64748b" value={descripcionAccidente} onChangeText={setDescripcionAccidente} multiline numberOfLines={4} returnKeyType="done" blurOnSubmit onSubmitEditing={guardarAccidente} />
              <TouchableOpacity style={{ marginTop: 15, backgroundColor: '#3b82f6', borderRadius: 10, padding: 10, alignItems: 'center' }} onPress={tomarFoto}><Text style={{ color: 'white', fontWeight: 'bold' }}>📷 Tomar Foto</Text></TouchableOpacity>
              {imagenUri && <Image source={{ uri: imagenUri }} style={{ width: 120, height: 90, marginTop: 10, borderRadius: 10, alignSelf: 'center' }} />}
            </View>
            <View style={[styles.locationInfo, { backgroundColor: '#e0f2fe' }]}><Text style={styles.locationIcon}>📍</Text><Text style={[styles.locationText, { color: '#0369a1', fontWeight: 'bold' }]}>Se guardará tu ubicación actual</Text></View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]} onPress={() => { setModalVisible(false); setDescripcionAccidente(''); setNivelAlerta(null); setImagenUri(null); }}><Text style={[styles.cancelButtonText, { color: '#334155', fontWeight: 'bold' }]}>❌ Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={guardarAccidente}><Text style={styles.saveButtonText}>✅ Reportar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal animationType="fade" transparent visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}><Text style={styles.deleteModalIcon}>🗑️</Text><Text style={styles.deleteModalTitle}>Eliminar Reporte</Text><Text style={styles.deleteModalSubtitle}>¿Seguro que deseas eliminar este reporte?</Text></View>
            {selectedAccidente && (
              <View style={styles.accidentDetails}>
                <Text style={styles.accidentDetailsTitle}>📋 Detalles del reporte:</Text>
                <Text style={styles.accidentDetailsText}>{selectedAccidente.descripcion}</Text>
                {(selectedAccidente.usuario_nombre || selectedAccidente.usuario_correo) && <Text style={[styles.accidentDetailsText,{fontSize:12,color:'#475569'}]}>Autor: {selectedAccidente.usuario_nombre || selectedAccidente.usuario_correo}</Text>}
                {selectedAccidente.imagen && (
                  <TouchableOpacity onPress={() => { setImagenGrandeUri(selectedAccidente.imagen.startsWith('http') ? selectedAccidente.imagen : `http://${IP}:3000/${selectedAccidente.imagen}`); setModalImagenVisible(true); }}>
                    <Image source={{ uri: selectedAccidente.imagen.startsWith('http') ? selectedAccidente.imagen : `http://${IP}:3000/${selectedAccidente.imagen}` }} style={{ width: 180, height: 120, borderRadius: 10, marginVertical: 10, alignSelf: 'center', borderWidth: 1, borderColor: '#ddd' }} resizeMode="cover" />
                    <Text style={{ textAlign: 'center', color: '#2563eb', fontSize: 12 }}>Toca para ver grande</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.accidentDetailsDate}>📅 {new Date(selectedAccidente.fecha_creacion || selectedAccidente.created_at || Date.now()).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            )}
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelDeleteButton]} onPress={() => { setDeleteModalVisible(false); setSelectedAccidente(null); }}><Text style={styles.cancelDeleteButtonText}>↩️ Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmDeleteButton]} onPress={eliminarAccidente}><Text style={styles.confirmDeleteButtonText}>🗑️ Eliminar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={modalImagenVisible} transparent animationType="fade" onRequestClose={() => setModalImagenVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 40, right: 30 }} onPress={() => setModalImagenVisible(false)}><Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>✖️</Text></TouchableOpacity>
          {imagenGrandeUri && (<Image source={{ uri: imagenGrandeUri }} style={{ width: Dimensions.get('window').width - 40, height: Dimensions.get('window').height / 2, borderRadius: 18, borderWidth: 2, borderColor: '#fff' }} resizeMode="contain" />)}
        </View>
      </Modal>
      <Modal transparent visible={selectNumberModalVisible} animationType="fade" onRequestClose={() => setSelectNumberModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.selectNumberContent,{paddingBottom:20}]}> 
            <Text style={styles.phoneModalTitle}>Elige destinatario</Text>
            {phoneNumbers.map((p,idx) => (
              <TouchableOpacity key={`${p.number}-${idx}`} style={styles.selectNumberButton} onPress={() => openWhatsApp(p.number)}>
                <Text style={styles.selectNumberAlias}>{p.alias || 'Sin alias'}</Text>
                <Text style={styles.selectNumberNumber}>{p.number}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{marginTop:16, alignSelf:'center', paddingHorizontal:24, paddingVertical:12, backgroundColor:'#e2e8f0', borderRadius:12}} onPress={() => setSelectNumberModalVisible(false)}>
              <Text style={{ color: '#1e293b', fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e40af' },
  loadingCard: { backgroundColor: 'white', padding: 30, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  loadingText: { marginTop: 15, fontSize: 16, color: '#374151', fontWeight: '500' },
  mapContainer: { flex: 1, margin: 20, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  map: { flex: 1 },
  customMarkerUteq: { backgroundColor: '#3b82f6', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  customMarkerAccidente: { backgroundColor: '#ef4444', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  markerText: { fontSize: 18 },
  accidentCounter: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  counterText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  buttonContainer: { paddingHorizontal: 20, paddingBottom: 30, gap: 15 },
  addButton: { backgroundColor: '#ef4444', borderRadius: 15, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  configButton: { backgroundColor: '#0ea5e9', borderRadius: 15, shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 4.65, elevation: 8 },
  configOutlineButton: { borderWidth:2, borderColor:'#1e3a8a', borderRadius:15, marginTop:4, backgroundColor:'transparent' },
  configOutlineText: { fontSize:16, fontWeight:'700' },
  whatsappButton: { backgroundColor: '#22c55e', borderRadius: 15, shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24 },
  buttonIcon: { fontSize: 20, marginRight: 10 },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  configButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', borderRadius: 25, width: Dimensions.get('window').width - 40, maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 20 },
  modalHeader: { alignItems: 'center', paddingTop: 25, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalIcon: { fontSize: 40, marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 5 },
  modalSubtitle: { fontSize: 14, color: '#6b7280' },
  inputContainer: { padding: 20 },
  textInput: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 15, padding: 15, fontSize: 16, textAlignVertical: 'top', backgroundColor: '#f9fafb', minHeight: 100, color: '#374151' }, // color y fondo se sobreescriben en el componente
  locationInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#f0f9ff', marginHorizontal: 20, borderRadius: 12, paddingVertical: 12 }, // color se sobreescribe
  locationIcon: { fontSize: 16, marginRight: 8 },
  locationText: { fontSize: 14, color: '#0369a1', fontWeight: '500' },
  modalButtons: { flexDirection: 'row', padding: 20, gap: 12 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' }, // color se sobreescribe
  cancelButtonText: { color: '#6b7280', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#ef4444' },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  deleteModalContent: { backgroundColor: 'white', borderRadius: 25, width: Dimensions.get('window').width - 40, maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 20 },
  deleteModalHeader: { alignItems: 'center', paddingTop: 25, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  deleteModalIcon: { fontSize: 40, marginBottom: 10 },
  deleteModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#dc2626', marginBottom: 5 },
  deleteModalSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingHorizontal: 20 },
  accidentDetails: { padding: 20, backgroundColor: '#fef2f2', marginHorizontal: 20, marginVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca' },
  accidentDetailsTitle: { fontSize: 14, fontWeight: 'bold', color: '#991b1b', marginBottom: 8 },
  accidentDetailsText: { fontSize: 16, color: '#374151', marginBottom: 8, lineHeight: 22 },
  accidentDetailsDate: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },
  deleteModalButtons: { flexDirection: 'row', padding: 20, gap: 12 },
  cancelDeleteButton: { backgroundColor: '#f3f4f6' },
  cancelDeleteButtonText: { color: '#6b7280', fontSize: 16, fontWeight: '600' },
  confirmDeleteButton: { backgroundColor: '#dc2626' },
  confirmDeleteButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  phoneModalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  selectNumberContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: 300, maxWidth: '90%' },
  selectNumberButton: { backgroundColor: '#eff6ff', paddingVertical: 12, borderRadius: 12, paddingHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: '#bfdbfe' },
  selectNumberAlias: { textAlign: 'center', color: '#1e3a8a', fontWeight: '700', fontSize: 14 },
  selectNumberNumber: { textAlign: 'center', color: '#1d4ed8', fontWeight: '500', fontSize: 12, marginTop: 2, letterSpacing: 0.5 },
  editModalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: Dimensions.get('window').width - 60, maxWidth: 420 },
  statsBar:{ flexDirection:'row', justifyContent:'space-between', marginHorizontal:20, marginBottom:10, paddingVertical:10, paddingHorizontal:14, borderRadius:16, borderWidth:1 },
  statItem:{ alignItems:'center', minWidth:52 },
  statLabel:{ fontSize:10, fontWeight:'600', letterSpacing:0.5 },
  statValue:{ fontSize:14, fontWeight:'700', marginTop:2 },
  // Fin estilos
});
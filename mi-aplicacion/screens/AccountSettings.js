import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, Image, Modal, Switch, ActivityIndicator, Platform, StatusBar, SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '../context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { authFetch } from '../utils/authFetch';

// Pantalla de Configuraciones de Cuenta (números WhatsApp con alias)
export default function AccountSettings({ navigation }) {
  const { user, updateUser, loadingUser, logout } = useUser();
  const { theme, toggleTheme, themeName } = useTheme();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [preferences, setPreferences] = useState({ vibrateOnAlert: true, autoShare: false, theme: 'light' });
  const [manualVisible, setManualVisible] = useState(false);
  // Estados números
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [newPhone, setNewPhone] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editOriginal, setEditOriginal] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [editAlias, setEditAlias] = useState('');

  // Preferencias iniciales almacenadas
  useEffect(() => { (async () => { try { const p = await AsyncStorage.getItem('preferences'); if (p) setPreferences(JSON.parse(p)); } catch {} })(); }, []);

  const persistPreferences = async (next) => { setPreferences(next); try { await AsyncStorage.setItem('preferences', JSON.stringify(next)); } catch {} };
  const togglePref = (key) => { if (key==='theme'){ toggleTheme(); const next = { ...preferences, theme: themeName==='light'?'dark':'light' }; persistPreferences(next); } else { const next = { ...preferences, [key]: !preferences[key] }; persistPreferences(next);} };
  const getHeaders = async () => { const t = await AsyncStorage.getItem('authToken'); return t ? { Authorization: `Bearer ${t}` } : {}; };
  const uploadAvatar = async (localUri) => { try { if (!user?.correo || !localUri) return; const form = new FormData(); const filename = localUri.split('/').pop(); const ext = filename.split('.').pop(); const type = (ext==='jpg'||ext==='jpeg')? 'image/jpeg':'image/png'; form.append('avatar', { uri: localUri, name: filename, type }); const resp = await authFetch(`http://10.13.9.201:3000/usuario/${encodeURIComponent(user.correo)}/avatar`, { method:'POST', headers:{ Accept:'application/json' }, body: form }); const data = await resp.json(); if (resp.ok) { updateUser({ ...user, avatar: data.avatar }); } else { Alert.alert('Avatar', data.message||'Error al subir'); } } catch(e){ console.log(e); Alert.alert('Avatar','No se pudo subir'); } };
  const pickPhoto = async () => { try { const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (status !== 'granted') { Alert.alert('Permiso', 'Se requiere permiso de galería'); return; } const mediaTypes = ImagePicker.MediaType ? [ImagePicker.MediaType.Image] : (ImagePicker.MediaTypeOptions?.Images || []); const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing:true, quality:0.8, mediaTypes }); if (!res.canceled && res.assets?.length) { const asset = res.assets[0]; if (asset.fileSize && asset.fileSize > 2*1024*1024) { Alert.alert('Imagen','Máximo 2 MB'); return; } const ok = /\.(jpe?g|png)$/i.test(asset.uri); if(!ok){ Alert.alert('Formato','Solo JPG o PNG'); return;} const uri = asset.uri; updateUser({ ...user, fotoUri: uri }); await uploadAvatar(uri); } } catch(e){ console.log(e);} };
  const saveProfile = async () => { const nombreTrim = nombre.trim(); const correoTrim = correo.trim(); if (!nombreTrim || !correoTrim) { Alert.alert('Validación','Nombre y correo requeridos'); return; } if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoTrim)) { Alert.alert('Validación','Correo inválido'); return; } setSavingProfile(true); try { const body = { nombre: nombreTrim }; if (user?.correo !== correoTrim) body.nuevoCorreo = correoTrim; const resp = await authFetch(`http://10.13.9.201:3000/usuario/${encodeURIComponent(user?.correo)}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) }); const data = await resp.json(); if (!resp.ok) { Alert.alert('Error', data.message || 'No se pudo actualizar'); } else { updateUser({ nombre: nombreTrim, correo: correoTrim, avatar: user?.avatar, fotoUri: user?.fotoUri }); Alert.alert('Perfil','Datos guardados'); } } catch { Alert.alert('Error','Fallo de red'); } finally { setSavingProfile(false); } };
  const changePassword = async () => { if (!currentPass || !newPass || !confirmPass) { Alert.alert('Validación','Completa todos los campos'); return; } if (newPass !== confirmPass) { Alert.alert('Validación','Las contraseñas no coinciden'); return; } try { const resp = await authFetch(`http://10.13.9.201:3000/usuario/${encodeURIComponent(correo)}/password`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ actual: currentPass, nueva: newPass }) }); const data = await resp.json(); if (!resp.ok) { Alert.alert('Error', data.message||'No se pudo cambiar'); return; } Alert.alert('Éxito','Contraseña actualizada'); setShowPasswordModal(false); setCurrentPass(''); setNewPass(''); setConfirmPass(''); } catch { Alert.alert('Error','Fallo de red'); } };

  // Key específica por usuario para que cada cuenta tenga sus propios 3 números.
  const getNumbersKey = (correoUser) => correoUser ? `phoneNumbers:${correoUser.toLowerCase()}` : null;

  // Cargar números (y migrar si existía clave global anterior)
  useEffect(()=>{ 
    (async()=>{ 
      if(!user?.correo) return; 
      try { 
        const key = getNumbersKey(user.correo);
        let stored = await AsyncStorage.getItem(key);
        if(!stored){
          // Intentar migrar desde clave global antigua
            const legacy = await AsyncStorage.getItem('phoneNumbers');
            if(legacy){ stored = legacy; try { await AsyncStorage.setItem(key, legacy); await AsyncStorage.removeItem('phoneNumbers'); } catch {} }
        }
        if (stored){ 
          let parsed = JSON.parse(stored); 
          if (Array.isArray(parsed) && parsed.length && typeof parsed[0]==='string') parsed = parsed.map(p=>({number:p, alias:''}));
          // Sanitizar: limitar a 3, quitar duplicados
          const seen = new Set();
          const clean = [];
          for(const item of parsed){ if(item && item.number && !seen.has(item.number) && /^\d{10,15}$/.test(item.number)){ seen.add(item.number); clean.push({ number:item.number, alias:item.alias||''}); if(clean.length===3) break; } }
          setPhoneNumbers(clean);
        } else {
          setPhoneNumbers([]);
        }
      } catch(e){ console.log('Error cargando números', e); } 
    })(); 
  },[user]);

  // Cargar perfil inicial desde contexto
  useEffect(() => {
    if (user) {
  setNombre(user.nombre || '');
  setCorreo(user.correo || '');
    }
  }, [user]);

  const persist = async (list) => {
    setPhoneNumbers(list);
    try { if(user?.correo){ await AsyncStorage.setItem(getNumbersKey(user.correo), JSON.stringify(list)); } } catch {}
  };

  const addPhone = async () => {
    const phone = newPhone.trim();
    const alias = newAlias.trim();
    if (!/^\d{10,15}$/.test(phone)) { Alert.alert('Número inválido', 'Usa solo dígitos (10-15). Ej: 5215512345678'); return; }
    if (phoneNumbers.find(p => p.number === phone)) { Alert.alert('Duplicado', 'Ese número ya existe.'); return; }
    if (phoneNumbers.length >= 3) { Alert.alert('Límite', 'Máximo 3 números'); return; }
    const updated = [...phoneNumbers, { number: phone, alias }];
    await persist(updated);
    setNewPhone('');
    setNewAlias('');
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditOriginal(null);
    setEditPhone('');
    setEditAlias('');
  };

  const removePhone = async (number) => {
    Alert.alert('Confirmar', '¿Eliminar este número?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          const updated = phoneNumbers.filter(p => p.number !== number);
          await persist(updated);
        } }
    ]);
  };


  const clearAll = async () => {
    Alert.alert('Confirmar', '¿Eliminar todos los números?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await persist([]); } }
    ]);
  };

  const startEdit = (item) => {
    setEditMode(true);
    setEditOriginal(item.number);
    setEditPhone(item.number);
    setEditAlias(item.alias || '');
  };


  const saveEdit = async () => {
    const num = editPhone.trim();
    const alias = editAlias.trim();
    if (!/^\d{10,15}$/.test(num)) { Alert.alert('Número inválido','Formato incorrecto'); return; }
    if (num !== editOriginal && phoneNumbers.find(p=>p.number===num)) { Alert.alert('Duplicado','Ya existe ese número'); return; }
    const updated = phoneNumbers.map(p=> p.number===editOriginal ? { number: num, alias } : p);
    await persist(updated); cancelEdit();
  };

  if (loadingUser) {
    return <View style={{flex:1,justifyContent:'center',alignItems:'center', backgroundColor:'#f1f5f9'}}><ActivityIndicator size="large" color="#0ea5e9" /><Text style={{marginTop:10,color:'#334155'}}>Cargando perfil...</Text></View>;
  }

  return (
    <SafeAreaView style={{flex:1, backgroundColor: theme.colors.background}}>
    <ScrollView style={[styles.container,{ backgroundColor: theme.colors.background }]} contentContainerStyle={[styles.content,{ paddingTop: 12 }]}> 
  <Text style={[styles.title,{ color: theme.colors.text }]}>Configuraciones</Text>

      {/* Perfil */}
  <View style={[styles.card,{ backgroundColor: theme.colors.card }]}>
  <Text style={[styles.cardTitle,{ color: theme.colors.text }]}>Perfil</Text>
        <View style={{flexDirection:'row', alignItems:'center', marginBottom:14}}>
          <TouchableOpacity onPress={pickPhoto} style={styles.avatarWrapper}>
            {user?.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatar} /> : (user?.fotoUri ? <Image source={{ uri: user.fotoUri }} style={styles.avatar} /> : <Text style={styles.avatarPlaceholder}>👤</Text>)}
          </TouchableOpacity>
          <View style={{flex:1, marginLeft:12}}>
            <TextInput style={[styles.input,{backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border}]} placeholder="Nombre" placeholderTextColor="#94a3b8" value={nombre} onChangeText={setNombre} />
            <TextInput style={[styles.input,{backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border}]} placeholder="Correo" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" value={correo} onChangeText={setCorreo} />
          </View>
        </View>
  <TouchableOpacity style={[styles.primaryBtn,{ backgroundColor: theme.colors.primary }]} onPress={saveProfile} disabled={savingProfile}>
          <Text style={styles.primaryBtnText}>{savingProfile ? 'Guardando...' : 'Guardar Perfil'}</Text>
        </TouchableOpacity>
  <TouchableOpacity style={[styles.secondaryBtn,{marginTop:10, backgroundColor: theme.colors.cardAlt}]} onPress={()=>setShowPasswordModal(true)}>
          <Text style={styles.secondaryBtnText}>Cambiar contraseña</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn,{marginTop:10, backgroundColor:'#fee2e2'}]} onPress={()=>{ logout(); Alert.alert('Sesión','Has cerrado sesión'); navigation.reset({index:0,routes:[{name:'Login'}]}); }}>
          <Text style={[styles.secondaryBtnText,{color: theme.colors.danger}]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Preferencias */}
  <View style={[styles.card,{ backgroundColor: theme.colors.card }]}>
  <Text style={[styles.cardTitle,{ color: theme.colors.text }]}>Preferencias</Text>
        <View style={styles.prefRow}>
          <Text style={[styles.prefLabel,{ color: theme.colors.text }]}>Vibrar en alertas</Text>
          <Switch value={preferences.vibrateOnAlert} onValueChange={()=>togglePref('vibrateOnAlert')} />
        </View>
        <View style={styles.prefRow}>
          <Text style={[styles.prefLabel,{ color: theme.colors.text }]}>Auto compartir ubicación</Text>
          <Switch value={preferences.autoShare} onValueChange={()=>togglePref('autoShare')} />
        </View>
        <View style={styles.prefRow}>
          <Text style={[styles.prefLabel,{ color: theme.colors.text }]}>Tema oscuro</Text>
          <Switch value={themeName==='dark'} onValueChange={()=>togglePref('theme')} />
        </View>
      </View>

      {/* Manual */}
  <View style={[styles.card,{ backgroundColor: theme.colors.card }]}>
  <Text style={[styles.cardTitle,{ color: theme.colors.text }]}>Ayuda</Text>
  <Text style={[styles.helper,{ color: theme.colors.textSecondary }]}>Consulta una guía rápida de uso.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={()=>setManualVisible(true)}>
          <Text style={styles.primaryBtnText}>Ver manual rápido</Text>
        </TouchableOpacity>
      </View>

  <Text style={[styles.sectionTitle,{ color: theme.colors.text }]}>Números de WhatsApp</Text>
  <Text style={[styles.helper,{ color: theme.colors.textSecondary }]}>Se usan para enviar tu ubicación. Máximo 3 registros.</Text>

      {!editMode && (
  <View style={[styles.addBlock,{ backgroundColor: theme.colors.card }]}>
          <Text style={[styles.blockTitle,{ color: theme.colors.text }]}>Agregar número</Text>
          <TextInput
            placeholder="5215512345678"
            placeholderTextColor="#9ca3af"
            style={[styles.input,{backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border}]}
            keyboardType="number-pad"
            value={newPhone}
            onChangeText={setNewPhone}
            maxLength={15}
          />
          <TextInput
            placeholder="Alias (ej: Coordinador)"
            placeholderTextColor="#9ca3af"
            style={[styles.input,{backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border}]}
            value={newAlias}
            onChangeText={setNewAlias}
            maxLength={30}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={addPhone}>
            <Text style={styles.primaryBtnText}>Añadir</Text>
          </TouchableOpacity>
        </View>
      )}

      {editMode && (
  <View style={[styles.addBlock,{ backgroundColor: theme.colors.card }]}>
          <Text style={[styles.blockTitle,{ color: theme.colors.text }]}>Editar número</Text>
          <TextInput
            style={[styles.input,{backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border}]}
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="number-pad"
            maxLength={15}
            placeholder="Número"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            style={[styles.input,{backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border}]}
            value={editAlias}
            onChangeText={setEditAlias}
            maxLength={30}
            placeholder="Alias"
            placeholderTextColor="#9ca3af"
          />
          <View style={styles.rowGap}>
            <TouchableOpacity style={[styles.secondaryBtn,{flex:1}]} onPress={cancelEdit}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn,{flex:1}]} onPress={saveEdit}>
              <Text style={styles.primaryBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

  <Text style={[styles.blockTitle,{marginTop:20, color: theme.colors.text}]}>Lista</Text>
      {phoneNumbers.length === 0 && (
  <Text style={[styles.empty,{ color: theme.colors.textSecondary }]}>No hay números configurados.</Text>
      )}
      <FlatList
        data={phoneNumbers}
        keyExtractor={item => item.number}
        scrollEnabled={false}
        renderItem={({item}) => (
          <View style={[styles.itemRow,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{flex:1}}>
              <Text style={[styles.alias,{ color: theme.colors.text }]}>{item.alias || 'Sin alias'}</Text>
              <Text style={[styles.number,{ color: theme.colors.textSecondary }]}>{item.number}</Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity style={[styles.smallBtn,{backgroundColor:'#2563eb'}]} onPress={()=>startEdit(item)}>
                <Text style={styles.smallBtnText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn,{backgroundColor:'#dc2626'}]} onPress={()=>removePhone(item.number)}>
                <Text style={styles.smallBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      {phoneNumbers.length>0 && (
        <TouchableOpacity style={styles.dangerLink} onPress={clearAll}>
          <Text style={styles.dangerLinkText}>Eliminar todos</Text>
        </TouchableOpacity>
      )}

      <View style={{height:40}} />

      {/* Modal cambiar contraseña */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={()=>setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle,{ color: theme.colors.text }]}>Cambiar contraseña</Text>
            <TextInput style={styles.input} placeholder="Actual" placeholderTextColor="#94a3b8" secureTextEntry value={currentPass} onChangeText={setCurrentPass} />
            <TextInput style={styles.input} placeholder="Nueva" placeholderTextColor="#94a3b8" secureTextEntry value={newPass} onChangeText={setNewPass} />
            <TextInput style={styles.input} placeholder="Confirmar" placeholderTextColor="#94a3b8" secureTextEntry value={confirmPass} onChangeText={setConfirmPass} />
            <View style={styles.rowGap}>
              <TouchableOpacity style={[styles.secondaryBtn,{flex:1}]} onPress={()=>setShowPasswordModal(false)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn,{flex:1}]} onPress={changePassword}>
                <Text style={styles.primaryBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual rápido */}
      <Modal visible={manualVisible} transparent animationType="slide" onRequestClose={()=>setManualVisible(false)}>
        <View style={styles.manualOverlay}>
          <View style={styles.manualCard}>
            <Text style={[styles.manualTitle,{ color: theme.colors.text }]}>Manual Rápido</Text>
            <ScrollView style={{maxHeight:340, marginTop:10}}>
              <Text style={[styles.manualSection,{ color: theme.colors.text }]}>🚨 Reportar Accidente</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>1. Pulsa el botón ROJO 🚨 en el Panel.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>2. Selecciona nivel: Rojo (grave), Amarillo (moderado), Verde (leve).</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>3. Escribe una descripción clara y opcionalmente toma una foto.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>4. Confirma: se enviarán correos automáticos según el nivel.</Text>

              <Text style={[styles.manualSection,{ color: theme.colors.text }]}>📍 Compartir Ubicación</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>5. Configura hasta 3 números (con alias) en esta pantalla.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>6. En el Panel toca Enviar Ubicación para abrir WhatsApp con tu posición.</Text>

              <Text style={[styles.manualSection,{ color: theme.colors.text }]}>🧑 Perfil y Preferencias</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>7. Cambia tu nombre, avatar o contraseña aquí.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>8. Activa vibración o modo oscuro según prefieras.</Text>

              <Text style={[styles.manualSection,{ color: theme.colors.text }]}>📊 Analíticas (roles autorizados)</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>9. Solo admin/gestor/superadmin ven el botón Analíticas.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>10. Allí se muestra resumen simple: totales, horarios y mapa de calor.</Text>

              <Text style={[styles.manualSection,{ color: theme.colors.text }]}>✅ Buenas Prácticas</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>• Mantén GPS activo para precisión.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>• Evita subir fotos borrosas o oscuras.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>• No compartas datos personales en la descripción.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>• Actualiza números si cambian responsables.</Text>
              <Text style={[styles.manualItem,{ color: theme.colors.textSecondary }]}>• Cierra sesión si usas un dispositivo compartido.</Text>
            </ScrollView>
            <TouchableOpacity style={[styles.primaryBtn,{marginTop:16}]} onPress={()=>setManualVisible(false)}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
  </ScrollView>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f1f5f9' },
  content: { padding:20 },
  title: { fontSize:24, fontWeight:'700', color:'#0f172a', marginBottom:16, textAlign:'center' },
  card: { backgroundColor:'#ffffff', padding:16, borderRadius:16, marginBottom:18, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, elevation:3 },
  cardTitle: { fontSize:16, fontWeight:'700', color:'#1e293b', marginBottom:12 },
  avatarWrapper: { width:72, height:72, borderRadius:36, backgroundColor:'#e2e8f0', alignItems:'center', justifyContent:'center' },
  avatar: { width:72, height:72, borderRadius:36 },
  avatarPlaceholder: { fontSize:32 },
  prefRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:6 },
  prefLabel: { color:'#334155', fontSize:14 },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:20 },
  modalCard: { backgroundColor:'#fff', width:'100%', borderRadius:20, padding:20 },
  modalTitle: { fontSize:18, fontWeight:'700', color:'#0f172a', marginBottom:10, textAlign:'center' },
  manualOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:24 },
  manualCard: { backgroundColor:'#fff', borderRadius:24, padding:24 },
  manualTitle: { fontSize:20, fontWeight:'700', color:'#0f172a', textAlign:'center' },
  manualSection: { fontSize:14, fontWeight:'700', marginTop:12, marginBottom:6, letterSpacing:0.3 },
  manualItem: { fontSize:13, color:'#334155', marginBottom:8, lineHeight:18 },
  sectionTitle: { fontSize:16, fontWeight:'600', color:'#1e293b', marginBottom:4 },
  helper: { fontSize:12, color:'#64748b', marginBottom:16 },
  addBlock: { backgroundColor:'#ffffff', padding:16, borderRadius:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, elevation:3 },
  blockTitle: { fontSize:14, fontWeight:'700', color:'#334155', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 },
  input: { borderWidth:2, borderColor:'#e2e8f0', borderRadius:12, paddingHorizontal:12, paddingVertical:10, fontSize:14, marginBottom:10, backgroundColor:'#f8fafc', color:'#0f172a' },
  primaryBtn: { backgroundColor:'#0ea5e9', paddingVertical:14, borderRadius:12, alignItems:'center' },
  primaryBtnText: { color:'white', fontWeight:'700', letterSpacing:0.5 },
  secondaryBtn: { backgroundColor:'#f1f5f9', paddingVertical:14, borderRadius:12, alignItems:'center' },
  secondaryBtnText: { color:'#475569', fontWeight:'600' },
  rowGap: { flexDirection:'row', gap:12 },
  empty: { fontSize:13, color:'#64748b', fontStyle:'italic', marginTop:6 },
  itemRow: { flexDirection:'row', alignItems:'center', backgroundColor:'#ffffff', borderRadius:14, padding:14, marginTop:10, borderWidth:1, borderColor:'#e2e8f0' },
  alias: { fontSize:13, fontWeight:'700', color:'#1e293b' },
  number: { fontSize:12, color:'#334155', marginTop:2 },
  itemActions: { flexDirection:'row', gap:8 },
  smallBtn: { paddingHorizontal:14, paddingVertical:8, borderRadius:10 },
  smallBtnText: { color:'white', fontSize:12, fontWeight:'700' },
  dangerLink: { marginTop:14, alignSelf:'flex-start' },
  dangerLinkText: { color:'#dc2626', fontSize:12, fontWeight:'600' }
});

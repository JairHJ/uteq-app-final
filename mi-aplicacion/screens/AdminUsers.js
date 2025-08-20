import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, Platform, StatusBar, SafeAreaView, RefreshControl } from 'react-native';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { authFetch } from '../utils/authFetch';

const IP = '10.13.9.201';

export default function AdminUsers({ navigation }) {
  const { user } = useUser();
  const { theme } = useTheme();
  const [nombre,setNombre] = useState('');
  const [correo,setCorreo] = useState('');
  const [contrasena,setContrasena] = useState('');
  const [rol,setRol] = useState('reporter');
  const [creating,setCreating] = useState(false);
  const [changing,setChanging] = useState(false);
  const [list,setList] = useState([]);
  const [search,setSearch] = useState('');
  const [page,setPage] = useState(1);
  const [totalPages,setTotalPages] = useState(1);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState('');
  const [refreshing,setRefreshing] = useState(false);
  // Eliminado filtrado por rol

  const roles = ['admin','gestor','reporter'];

  useEffect(()=>{ if(!user || user.rol!=='superadmin'){ Alert.alert('Acceso','Solo superadmin'); navigation.goBack(); return; } fetchUsers(); },[user]);
  useEffect(()=>{ if(page>1) fetchUsers(false); },[page]);
  useEffect(()=>{ const debounce = setTimeout(()=>{ fetchUsers(true); },350); return ()=>clearTimeout(debounce); },[search]);

  const fetchUsers = async (reset=false) => {
    try {
      setLoading(true);
      const targetPage = reset? 1 : page;
      const qsParts = [];
      if(search) qsParts.push(`search=${encodeURIComponent(search)}`);
  // (filterRol eliminado: causaba ReferenceError y abortaba la carga)
      qsParts.push(`page=${targetPage}`);
      qsParts.push(`pageSize=15`);
      const qs = qsParts.length? `?${qsParts.join('&')}`:'';
      const resp = await authFetch(`http://${IP}:3000/admin/usuarios${qs}`);
      const data = await resp.json();
      if(resp.ok && data && Array.isArray(data.items)) {
        const filtered = data.items.filter(u=>u.correo!==user.correo); // ocultar propio superadmin
        if(reset) setList(filtered); else setList(prev=>[...prev, ...filtered.filter(nv=> !prev.find(p=>p.correo===nv.correo))]);
        setTotalPages(data.totalPages||1);
        setPage(data.page||1);
        setLoadError(filtered.length===0 ? 'No hay otros usuarios registrados.' : '');
      } else {
        setLoadError(data?.message || 'No se pudieron obtener usuarios');
      }
    } catch(e){
      setLoadError('Error de red al cargar usuarios');
    } finally { setLoading(false); }
  };

  const crearUsuario = async () => {
    if(!nombre.trim()||!correo.trim()||!contrasena.trim()) { Alert.alert('Validación','Completa todos los campos'); return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) { Alert.alert('Correo','Formato inválido'); return; }
    setCreating(true);
    try {
      const resp = await authFetch(`http://${IP}:3000/admin/usuarios`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ nombre:nombre.trim(), correo:correo.trim().toLowerCase(), contrasena:contrasena.trim(), rol }) });
      const data = await resp.json();
      if(!resp.ok) { Alert.alert('Error', data.message||'No se pudo crear'); }
      else { Alert.alert('Éxito','Usuario creado'); setNombre(''); setCorreo(''); setContrasena(''); setRol('reporter'); }
    } catch { Alert.alert('Error','Fallo de red'); } finally { setCreating(false); }
  };

  const cambiarRol = async (correoTarget, nextRol) => {
    setChanging(true);
    try {
      const resp = await authFetch(`http://${IP}:3000/admin/usuarios/${encodeURIComponent(correoTarget)}/rol`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ rol: nextRol }) });
      const data = await resp.json();
  if(!resp.ok) Alert.alert('Error', data.message||'No se actualizó'); else { Alert.alert('Actualizado','Rol modificado'); setList(prev=> prev.map(u=> u.correo===correoTarget? { ...u, rol: nextRol }: u)); }
    } catch { Alert.alert('Error','Fallo de red'); } finally { setChanging(false); }
  };
  const eliminarUsuario = async (correoTarget) => {
    Alert.alert('Confirmar','¿Eliminar este usuario?',[
      { text:'Cancelar', style:'cancel' },
      { text:'Eliminar', style:'destructive', onPress: async ()=>{
          try {
            const resp = await authFetch(`http://${IP}:3000/admin/usuarios/${encodeURIComponent(correoTarget)}`, { method:'DELETE' });
            const data = await resp.json();
            if(!resp.ok) Alert.alert('Error', data.message||'No se eliminó'); else { Alert.alert('Eliminado','Usuario borrado'); setList(prev=> prev.filter(u=>u.correo!==correoTarget)); }
          } catch { Alert.alert('Error','Fallo de red'); }
        } }
    ]);
  };

  return (
    <SafeAreaView style={[styles.container,{ backgroundColor: theme.colors.background }]}> 
      <StatusBar barStyle={theme.dark?'light-content':'dark-content'} />
      <View style={[styles.headerRow,{ paddingTop: Platform.OS==='android'?4:0 }]}> 
  <TouchableOpacity onPress={()=>navigation.goBack()} style={{paddingVertical:4,paddingRight:14,paddingLeft:8}}>
          <Text style={[styles.back,{ color: theme.colors.primary }]}>◀ Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.title,{ color: theme.colors.text, textAlign:'center', flex:1 }]}>Gestión de Usuarios</Text>
        <View style={{width:70}} />
      </View>

      <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
        <Text style={[styles.sectionTitle,{ color: theme.colors.text }]}>Crear nuevo usuario</Text>
        <TextInput value={nombre} onChangeText={setNombre} placeholder='Nombre' placeholderTextColor={theme.colors.textSecondary} style={[styles.input,{ backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border }]} />
        <TextInput value={correo} onChangeText={setCorreo} placeholder='Correo' autoCapitalize='none' keyboardType='email-address' placeholderTextColor={theme.colors.textSecondary} style={[styles.input,{ backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border }]} />
        <TextInput value={contrasena} onChangeText={setContrasena} placeholder='Contraseña' secureTextEntry placeholderTextColor={theme.colors.textSecondary} style={[styles.input,{ backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border }]} />
        <View style={styles.rolesRow}>
          {roles.map(r=> (
            <TouchableOpacity key={r} onPress={()=>setRol(r)} style={[styles.roleChip, rol===r && styles.roleChipActive]}> 
              <Text style={[styles.roleChipText, rol===r && styles.roleChipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity disabled={creating} onPress={crearUsuario} style={[styles.primaryBtn,{ opacity: creating?0.6:1 }]}> 
          {creating? <ActivityIndicator color='#fff' /> : <Text style={styles.primaryBtnText}>Crear</Text>}
        </TouchableOpacity>
      </View>

      <View style={[styles.card,{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, flex:1 }]}> 
        <Text style={[styles.sectionTitle,{ color: theme.colors.text }]}>Usuarios</Text>
        <View style={styles.searchRow}> 
          <TextInput value={search} onChangeText={setSearch} placeholder='Buscar nombre o correo' placeholderTextColor={theme.colors.textSecondary} style={[styles.input,{ flex:1, backgroundColor: theme.colors.cardAlt, color: theme.colors.text, borderColor: theme.colors.border, marginBottom:0 }]} />
          <TouchableOpacity onPress={()=>{ fetchUsers(true); }} style={[styles.searchBtn,{ backgroundColor: theme.colors.primary }]}><Text style={styles.searchBtnText}>Buscar</Text></TouchableOpacity>
        </View>
  {/* Eliminado resumen de conteos */}
  {loading && <ActivityIndicator color={theme.colors.primary} style={{marginBottom:6}} />}
  {!!loadError && !loading && <Text style={{ color:'#dc2626', fontSize:12, marginBottom:6 }}>{loadError}</Text>}
        <FlatList
          data={list}
          keyExtractor={item=>item.correo}
          onEndReachedThreshold={0.4}
          onEndReached={()=>{ if(!loading && page < totalPages) { setPage(p=>p+1); } }}
          renderItem={({item})=>{
            return (
              <View style={[styles.userRow,{ borderColor: theme.colors.border }]}> 
                <View style={{flex:1}}>
                  <Text style={[styles.userName,{ color: theme.colors.text }]}>{item.nombre}</Text>
                  <Text style={[styles.userEmail,{ color: theme.colors.textSecondary }]}>{item.correo}</Text>
                  <Text style={[styles.userRoleLabel,{ color: theme.colors.textSecondary }]}>Rol actual: <Text style={{color: item.rol==='admin'?'#dc2626': item.rol==='gestor'?'#0ea5e9':'#16a34a'}}>{item.rol}</Text></Text>
                </View>
                <View style={styles.roleButtons}>
                  {roles.map(r=> (
                    <TouchableOpacity key={r} disabled={changing || item.rol===r} onPress={()=>cambiarRol(item.correo,r)} style={[styles.roleSmallBtn, item.rol===r && styles.roleSmallBtnActive]}> 
                      <Text style={[styles.roleSmallBtnText, item.rol===r && styles.roleSmallBtnTextActive]}>{r[0].toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity disabled={changing} onPress={()=>eliminarUsuario(item.correo)} style={[styles.deleteBtn]}> 
                    <Text style={styles.deleteBtnText}>✖</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={!loading && !loadError ? <Text style={{ color: theme.colors.textSecondary, fontSize:12 }}>No hay usuarios (solo estás tú).</Text>: null}
          ListFooterComponent={ list.length>0 ? (
            loading && page < totalPages ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical:12 }} />
            ) : (!loading && page >= totalPages ? (
              <Text style={{ textAlign:'center', color: theme.colors.textSecondary, fontSize:12, paddingVertical:8 }}>Fin de la lista</Text>
            ) : null)
          ) : null }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={()=>{ setRefreshing(true); fetchUsers(true).finally(()=>setRefreshing(false)); }}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom:10 }}
  />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, paddingHorizontal:16, paddingTop:8 },
  headerRow:{ flexDirection:'row', alignItems:'center', marginBottom:16 },
  title:{ fontSize:20, fontWeight:'700' },
  back:{ fontSize:14, fontWeight:'600' },
  card:{ borderWidth:1, borderRadius:16, padding:16, marginBottom:16 },
  sectionTitle:{ fontSize:14, fontWeight:'700', marginBottom:10, letterSpacing:0.5, textTransform:'uppercase' },
  input:{ borderWidth:2, borderRadius:12, paddingHorizontal:12, paddingVertical:10, fontSize:14, marginBottom:10 },
  rolesRow:{ flexDirection:'row', gap:8, marginBottom:10 },
  roleChip:{ paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:'#334155' },
  roleChipActive:{ backgroundColor:'#0ea5e9' },
  roleChipText:{ color:'#94a3b8', fontSize:12, fontWeight:'600' },
  roleChipTextActive:{ color:'#fff' },
  primaryBtn:{ backgroundColor:'#ef4444', paddingVertical:14, borderRadius:12, alignItems:'center' },
  primaryBtnText:{ color:'#fff', fontWeight:'700' }
  ,userRow:{ flexDirection:'row', padding:12, borderWidth:1, borderRadius:12, marginBottom:10 }
  ,userName:{ fontSize:14, fontWeight:'700' }
  ,userEmail:{ fontSize:11, marginTop:2 }
  ,userRoleLabel:{ fontSize:11, marginTop:4 }
  ,roleButtons:{ justifyContent:'center', alignItems:'center', flexDirection:'row', gap:4 }
  ,roleSmallBtn:{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:'#334155' }
  ,roleSmallBtnActive:{ backgroundColor:'#0ea5e9' }
  ,roleSmallBtnText:{ color:'#94a3b8', fontSize:12, fontWeight:'700' }
  ,roleSmallBtnTextActive:{ color:'#fff' }
  ,searchRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }
  ,searchBtn:{ paddingHorizontal:14, paddingVertical:12, borderRadius:12 }
  ,searchBtnText:{ color:'#fff', fontWeight:'700', fontSize:12 }
  ,deleteBtn:{ marginLeft:4, paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:'#dc2626' }
  ,deleteBtnText:{ color:'#fff', fontWeight:'700', fontSize:12 }
});

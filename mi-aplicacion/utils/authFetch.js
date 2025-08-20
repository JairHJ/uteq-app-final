import AsyncStorage from '@react-native-async-storage/async-storage';
let onUnauthorized = null;
export function setOnUnauthorized(cb){ onUnauthorized = cb; }
export async function authFetch(url, options = {}) {
  const token = await AsyncStorage.getItem('authToken');
  const headers = { ...(options.headers||{}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401 && onUnauthorized) onUnauthorized();
  return resp;
}

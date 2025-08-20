import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null); // { nombre, correo, fotoUri }
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('userProfile');
        if (stored) setUser(JSON.parse(stored));
      } catch {}
      setLoadingUser(false);
    })();
  }, []);

  const updateUser = async (partial) => {
    setUser(prev => {
      const next = { ...(prev||{}), ...partial };
      AsyncStorage.setItem('userProfile', JSON.stringify(next)).catch(()=>{});
      return next;
    });
  };

  const logout = async () => {
    try { await AsyncStorage.multiRemove(['userProfile','authToken']); } catch {}
    setUser(null);
  };

  return (
  <UserContext.Provider value={{ user, updateUser, loadingUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() { return useContext(UserContext); }

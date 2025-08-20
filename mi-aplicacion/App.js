import React from 'react';
import { UserProvider } from './context/UserContext';
import { NavigationContainer, DefaultTheme as NavDefault, DarkTheme as NavDark } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './screens/home';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import Panel from './screens/Panel'; 
import AdminUsers from './screens/AdminUsers';
import AnalyticsScreen from './screens/AnalyticsScreen';
import AccountSettings from './screens/AccountSettings';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const Stack = createNativeStackNavigator();

function InnerNav(){
  const { themeName } = useTheme();
  const navTheme = themeName==='dark'? { ...NavDark } : { ...NavDefault };
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown:false }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Registro" component={RegisterScreen} />
  <Stack.Screen name="Panel" component={Panel} /> 
  <Stack.Screen name="Analiticas" component={AnalyticsScreen} />
  <Stack.Screen name="Configuraciones" component={AccountSettings} />
  <Stack.Screen name="AdminUsuarios" component={AdminUsers} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App(){
  return (
    <ThemeProvider>
      <UserProvider>
        <InnerNav />
      </UserProvider>
    </ThemeProvider>
  );
}
// api-server/server.js

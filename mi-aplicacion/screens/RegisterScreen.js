import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const PAN_DURATION = 12000;
const IP = '10.13.9.201'; // Cambia aquí la IP y puerto

export default function RegisterScreen({ navigation }) {
  const player = useVideoPlayer(require('../assets/video-banner.mp4'), (p) => {
    try { p.loop = true; p.muted = true; p.play(); } catch(e) {}
  });
  const overscan = 4;
  const videoWidth = height * (16/9) + overscan * 2;
  const travel = Math.max(0, videoWidth - width);
  const startX = -overscan;
  const endX = startX - travel;
  const panX = useRef(new Animated.Value(startX)).current;
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (travel > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(panX, { toValue: endX, duration: PAN_DURATION, useNativeDriver: true }),
          Animated.timing(panX, { toValue: startX, duration: PAN_DURATION, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [travel, endX, startX]);

  const handleRegister = () => {
    if (!nombre || !correo || !contrasena) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    fetch(`http://${IP}:3000/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, contrasena }),
    })
      .then(res => {
        if (res.status === 201) return res.json();
        else if (res.status === 409) throw new Error('Correo ya registrado');
        else throw new Error('Error en el registro');
      })
      .then(data => {
        Alert.alert('Éxito', data.message);
        navigation.navigate('Login');
      })
      .catch(error => {
        Alert.alert('Error', error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const renderInput = (
    value,
    onChangeText,
    placeholder,
    iconName,
    keyboardType = 'default',
    secureTextEntry = false,
    fieldName
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{placeholder}</Text>
      <View style={[
        styles.inputWrapper,
        focusedField === fieldName && styles.inputWrapperFocused
      ]}>
        <Ionicons 
          name={iconName} 
          size={20} 
          color={focusedField === fieldName ? "#4c51bf" : "#9ca3af"} 
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, secureTextEntry && styles.passwordInput]}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          onFocus={() => setFocusedField(fieldName)}
          onBlur={() => setFocusedField(null)}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons 
              name={showPassword ? "eye-off-outline" : "eye-outline"} 
              size={20} 
              color="#9ca3af"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="rgba(0,0,0,0.25)" />
      <View style={styles.videoContainer}>
        <Animated.View style={[styles.panningLayer, { width: videoWidth, height, transform:[{ translateX: panX }] }]}> 
          <VideoView
            style={{ width:'100%', height:'100%' }}
            player={player}
            contentFit="cover"
            allowsPictureInPicture={false}
            allowsFullscreen={false}
          />
        </Animated.View>
        <View style={styles.overlay} />
        <LinearGradient colors={[ 'rgba(15,23,42,0.85)','rgba(15,23,42,0)' ]} style={styles.topFade} start={{x:0.5,y:0}} end={{x:0.5,y:1}} pointerEvents="none" />
        <LinearGradient colors={[ 'rgba(15,23,42,0)','rgba(15,23,42,0.7)' ]} style={styles.bottomFade} start={{x:0.5,y:0}} end={{x:0.5,y:1}} pointerEvents="none" />
      </View>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Logo Section */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="person-add" size={50} color="#fff" />
              </View>
              <Text style={styles.title}>¡Únete a nosotros!</Text>
              <Text style={styles.subtitle}>Crea tu cuenta y comienza tu experiencia</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              {renderInput(
                nombre,
                setNombre,
                'Nombre completo',
                'person-outline',
                'default',
                false,
                'nombre'
              )}

              {renderInput(
                correo,
                setCorreo,
                'Correo electrónico',
                'mail-outline',
                'email-address',
                false,
                'correo'
              )}

              {renderInput(
                contrasena,
                setContrasena,
                'Contraseña',
                'lock-closed-outline',
                'default',
                true,
                'contrasena'
              )}

              {/* Password Requirements */}
              <View style={styles.passwordRequirements}>
                <Text style={styles.requirementsTitle}>Tu contraseña debe tener:</Text>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={contrasena.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={contrasena.length >= 6 ? "#10b981" : "#9ca3af"} 
                  />
                  <Text style={[
                    styles.requirementText,
                    contrasena.length >= 6 && styles.requirementTextMet
                  ]}>
                    Al menos 6 caracteres
                  </Text>
                </View>
              </View>

              {/* Register Button */}
              <TouchableOpacity 
                style={[styles.registerButton, loading && styles.registerButtonDisabled]} 
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.loadingText}>Creando cuenta...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.registerButtonText}>Crear Cuenta</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Terms and Conditions */}
              <Text style={styles.termsText}>
                Al registrarte, aceptas nuestros{' '}
                <Text style={styles.termsLink}>Términos y Condiciones</Text>
                {' '}y{' '}
                <Text style={styles.termsLink}>Política de Privacidad</Text>
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Inicia sesión aquí</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoContainer:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#0f172a', overflow:'hidden' },
  panningLayer:{ position:'absolute', top:0, left:0, height:'100%' },
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(15,23,42,0.40)' },
  topFade:{ position:'absolute', top:0, left:0, right:0, height:110 },
  bottomFade:{ position:'absolute', bottom:0, left:0, right:0, height:150 },
  scrollContent: {
    flexGrow: 1,
    minHeight: height,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
  backgroundColor: 'rgba(16, 185, 129, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputWrapperFocused: {
    borderColor: '#10b981',
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  passwordRequirements: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  requirementTextMet: {
    color: '#10b981',
  },
  registerButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  termsLink: {
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  footerLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
import React, { useEffect, useRef } from 'react';
import { 
  StatusBar, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  Platform,
  Image
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const PAN_DURATION = 12000; // ms por tramo de paneo (ida o vuelta) - más lento

export default function Home({ navigation }) {
  const player = useVideoPlayer(require('../assets/video-banner.mp4'), (playerInstance) => {
    try {
      playerInstance.loop = true;
      playerInstance.muted = true;
      playerInstance.play();
    } catch(e) {}
  });
  // Paneo horizontal: evitar mostrar espacio vacío (solo valores negativos o 0)
  const overscan = 4; // pixeles extra para evitar líneas vacías
  const videoWidth = height * (16/9) + overscan * 2; // ancho efectivo del video (altura = pantalla)
  const travel = Math.max(0, videoWidth - width); // cuánto debe desplazarse para mostrar el otro lado
  const startX = -overscan; // arranca con pequeño overscan a la izquierda
  const endX = startX - travel; // desplazamiento negativo total
  const panX = useRef(new Animated.Value(startX)).current;

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleButtonPress = (route) => {
    navigation.navigate(route);
  };

  return (
    <View style={styles.container}>
      {/* Video de fondo con recorte lateral leve para ganar altura visual */}
      <View style={styles.videoContainer}>
        {/* Paneo horizontal animado para mostrar zonas laterales */}
  <Animated.View style={[styles.videoBackground, { width: videoWidth, height: height, transform:[{ translateX: panX }] }]}> 
          <VideoView
            style={{ width: '100%', height: '100%' }}
            player={player}
            contentFit="cover"
            allowsPictureInPicture={false}
            allowsFullscreen={false}
          />
        </Animated.View>
        <View style={styles.overlay} />
        {/* Degradados superior e inferior */}
  <LinearGradient colors={[ 'rgba(15,23,42,0.85)','rgba(15,23,42,0)' ]} style={styles.topFade} start={{x:0.5,y:0}} end={{x:0.5,y:1}} pointerEvents="none" />
  <LinearGradient colors={[ 'rgba(15,23,42,0)','rgba(15,23,42,0.7)' ]} style={styles.bottomFade} start={{x:0.5,y:0}} end={{x:0.5,y:1}} pointerEvents="none" />
      </View>
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
          {/* Logo/Icon Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image source={require('../assets/monitora-logo.jpg')} style={styles.logoImage} />
            </View>
          </View>

          {/* Title Section removido según solicitud */}
          <Text style={styles.subtitle}>
            Accede a tu cuenta o créate una nueva para comenzar
          </Text>

          {/* Buttons Container */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => handleButtonPress('Login')}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => handleButtonPress('Registro')}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="person-add-outline" size={20} color="#10b981" style={styles.buttonIcon} />
                <Text style={styles.secondaryButtonText}>Crear Cuenta</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer text */}
          <Text style={styles.footerText}>
            Al continuar, aceptas nuestros términos y condiciones
          </Text>
        </Animated.View>
      <StatusBar style="light" translucent backgroundColor="rgba(0,0,0,0.25)" barStyle="light-content" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoContainer:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#0f172a', overflow:'hidden' },
  videoBackground:{ position:'absolute', top:0, left:0, height:'100%' },
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(15,23,42,0.40)' },
  topFade:{ position:'absolute', top:0, left:0, right:0, height:120 },
  bottomFade:{ position:'absolute', bottom:0, left:0, right:0, height:160 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16,185,129,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(16,185,129,0.55)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  logoImage:{ width:110, height:110, borderRadius:55, resizeMode:'cover' },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 50,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  buttonsContainer: {
    width: '100%',
    gap: 20,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#10b981',
    borderRadius: 25,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.5)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonIcon: {
    marginRight: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});
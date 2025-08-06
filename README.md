# UTEQ-APP

Aplicación móvil y backend para botón de pánico y reportes, desarrollada con React Native (Expo), Node.js/Express y MySQL.

## Estructura del proyecto

```
uteq-app/
├── api-server/         # Backend Node.js/Express
├── mi-aplicacion/      # Frontend React Native (Expo)
├── appUsuarios.sql     # Script de base de datos
└── README.md           # Este archivo
```

---

## Requisitos
- Node.js 18+ y npm
- MySQL
- Expo Go (en tu dispositivo móvil)

---

## Instalación y ejecución

### 1. Clona el repositorio
```bash
git clone https://github.com/JairHJ/uteq-app-final.git
cd uteq-app-final
```

### 2. Configura la base de datos
- Crea una base de datos en MySQL (por ejemplo, `uteq_app`).
- Ejecuta el script `appUsuarios.sql` para crear las tablas necesarias.

### 3. Configura el backend
```bash
cd api-server
npm install
```
- Crea un archivo `.env` (opcional) o edita la configuración de conexión a MySQL en `server.js` según tus datos locales.
- Inicia el backend:
```bash
node server.js
```

### 4. Configura el frontend (Expo)
```bash
cd ../mi-aplicacion
npm install
```
- Edita la variable `IP` en los archivos de screens (por ejemplo, `LoginScreen.js`, `RegisterScreen.js`, `Panel.js`) para que apunte a la IP local de tu servidor backend.
- Inicia el proyecto Expo:
```bash
npx expo start
```
- Escanea el QR con Expo Go en tu celular.

---

## Funcionalidades principales
- Registro e inicio de sesión de usuarios.
- Reporte de incidentes con semáforo (rojo, amarillo, verde).
- Envío de alertas por correo según nivel de alerta.
- Adjuntar y visualizar imágenes en los reportes.
- Consulta de destinatarios de alertas desde la app.

---

## Notas importantes
- **No subas tu carpeta `node_modules` ni archivos sensibles.**
- Si cambias la IP del backend, recuerda actualizarla en el frontend.
- Si tienes problemas con dependencias, ejecuta `npm install` en cada carpeta (`api-server` y `mi-aplicacion`).

---

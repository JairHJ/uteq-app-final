# 04 Informe Técnico y Pruebas

*Asignado a: Fer*

## Informe Técnico del Backend (api-server/server.js)
El servidor está construido con Node.js y Express. Sus principales responsabilidades son:
- Conectarse a la base de datos MySQL.
- Exponer una API REST para gestionar usuarios y publicaciones.
- Manejar la subida de archivos con `multer` y guardarlos en el directorio `/uploads`.

## Casos de Prueba

| ID | Descripción | Pasos a seguir | Resultado Esperado | Resultado Obtenido | Estado |
|----|-------------|----------------|--------------------|--------------------|--------|
| TC01 | Registro de usuario exitoso | 1. ... | El usuario se crea en la BD | | |
| TC02 | Falla de inicio de sesión (pass incorrecto) | 1. ... | Mensaje de "Credenciales incorrectas" | | |

*(...continuar con más casos de prueba para las funcionalidades principales.)*

# 02 Arquitectura y Diseño

*Asignado a: Puga*

## Diagrama de Arquitectura

*(Insertar un diagrama simple que muestre la relación entre la App Móvil (React Native), la API Server (Node.js) y la Base de Datos (MySQL).)*

## Documentación de la API (api-server/server.js)

### Endpoint: `POST /register`
- **Descripción:** Registra un nuevo usuario.
- **Request Body:** `nombre`, `email`, `password`
- **Response:** Mensaje de éxito o error.

*(...continuar para /login, /posts, /upload, etc.)*

## Diseño de la Base de Datos (appUsuarios.sql)

### Tabla: `usuarios`
- `id`: INT, Primary Key, Auto-increment.
- `nombre`: VARCHAR.
- `email`: VARCHAR, Unique.
- `password`: VARCHAR (Hashed).
- `fecha_creacion`: TIMESTAMP.

*(...describir otras tablas si existen, como la de publicaciones.)*

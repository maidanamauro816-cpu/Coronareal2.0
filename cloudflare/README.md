# Corona Real — Cloudflare Workers + R2 + D1

## Qué incluye
- Worker API para listar/crear/editar/eliminar precios en D1.
- Worker API para listar/subir/eliminar imágenes de muestra en R2 bajo `galeria/{categoria}/`.
- Servidor de imágenes por el mismo Worker.
- CORS, validación de campos, límite de imagen de 8 MB y token de autorización para operaciones de escritura.

## 1. Crear recursos en Cloudflare
Desde la carpeta raíz del repo:

```bash
npm install -g wrangler
wrangler login
wrangler r2 bucket create corona-real
wrangler d1 create corona-real-db
```

Copiá el `database_id` real que entrega D1 en `wrangler.toml`, reemplazando `REEMPLAZAR_CON_EL_ID_REAL_DE_D1`.

## 2. Crear tabla
```bash
wrangler d1 execute corona-real-db --remote --file=cloudflare/schema.sql
```

## 3. Configurar token de escritura
```bash
wrangler secret put API_ADMIN_TOKEN
```
Pegá un secreto largo y aleatorio. No lo incluyas en el código de la app ni lo subas al repositorio. En esta primera versión el token protege las escrituras; antes de habilitar a muchos profesionales, integrá Firebase Authentication (verificación de Firebase ID token en el Worker) y autorización por rol profesional. No compartas un token global con clientes.

## 4. Publicar
```bash
wrangler deploy
```
La URL resultante será algo como `https://corona-real-api.<tu-subdominio>.workers.dev`.

## Endpoints

### Precios
- `GET /api/precios` — todos los precios.
- `GET /api/precios?categoria=cabello` — filtrar categoría.
- `POST /api/precios` — crea; JSON: `{"categoria":"cabello","servicio":"Corte clásico","precio":5000,"descripcion":"Incluye lavado"}`.
- `PUT /api/precios/{id}` — actualiza con el mismo JSON.
- `DELETE /api/precios/{id}` — elimina.

### Galería
- `GET /api/galeria/{categoria}` — lista imágenes.
- `POST /api/galeria/{categoria}?nombre=corte.jpg` — sube bytes de la imagen; Content-Type debe ser image/jpeg, image/png, image/webp o image/avif. Requiere token.
- `DELETE /api/galeria/{categoria}?key=galeria%2Fcabello%2Farchivo.jpg` — elimina una imagen de esa categoría; requiere token.
- Las URLs devueltas para imágenes apuntan al Worker y se sirven desde R2.

Ejemplo de subida:
```bash
curl -X POST 'https://TU-WORKER.workers.dev/api/galeria/cabello?nombre=corte.jpg' \
  -H 'Authorization: Bearer TU_TOKEN' \
  -H 'Content-Type: image/jpeg' \
  --data-binary '@corte.jpg'
``

## Importante sobre las pantallas 05 y 06
El Worker entrega precios e imágenes desde Cloudflare. La aplicación todavía debe llamar estos endpoints y mostrar una imagen local original como fallback cuando la lista de galería esté vacía. Este commit no altera ni reemplaza ninguna imagen existente y no activa datos dinámicos en la UI automáticamente.

## Seguridad y producción
La clave `API_ADMIN_TOKEN` es una protección inicial para pruebas controladas, no autenticación multi-profesional. Antes de producción, cambiarla por verificación de Firebase ID token y autorización de rol en el Worker, y asociar las imágenes/precios al identificador del profesional. CORS no es autenticación.


## Despliegue con GitHub Actions (estructura aislada)
La configuración de Cloudflare está separada del código de la app:
- `cloudflare/package.json`: dependencias y comandos locales de Wrangler.
- `wrangler.toml`: Worker, binding R2 y binding D1.
- `cloudflare/worker.js`: endpoints de la API.
- `cloudflare/schema.sql`: esquema de D1.
- `.github/workflows/deploy-cloudflare-worker.yml`: despliegue manual.

Antes de ejecutar el workflow:
1. Creá el bucket R2 `corona-real` y la base D1 `corona-real-db` en la misma cuenta de Cloudflare.
2. Reemplazá `REEMPLAZAR_CON_EL_ID_REAL_DE_D1` por el ID real de D1 en `wrangler.toml`.
3. En GitHub → Settings → Secrets and variables → Actions, agregá los secretos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `API_ADMIN_TOKEN`.
4. Abrí Actions → **Deploy Corona Real Cloudflare Worker** → Run workflow.

El workflow aplica el esquema D1 y publica el Worker. No crea la cuenta ni los recursos R2/D1 por vos. La UI de la app y la autorización por rol profesional siguen siendo tareas separadas; nunca pongas `API_ADMIN_TOKEN` dentro de la app.

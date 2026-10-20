const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function responseJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = env.CORS_ORIGIN || "*";
  const allowed = configured === "*" || configured.split(",").map(x => x.trim()).includes(origin);
  return {
    "access-control-allow-origin": allowed ? (configured === "*" ? "*" : origin) : "null",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type,Authorization",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function json(request, env, data, status = 200, headers = {}) {
  return responseJson(data, status, { ...corsHeaders(request, env), ...headers });
}

function error(request, env, message, status = 400) {
  return json(request, env, { error: message }, status);
}

function validCategory(value) {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 60 &&
    /^[a-zA-Z0-9_-]+$/.test(value);
}

function safeFilename(value) {
  const cleaned = (value || "imagen").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  return cleaned || "imagen";
}

function authorized(request, env) {
  const secret = env.API_ADMIN_TOKEN;
  if (!secret) return false;
  return request.headers.get("Authorization") === `Bearer ${secret}`;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function handlePrecios(request, env, url) {
  if (request.method === "GET") {
    const categoria = url.searchParams.get("categoria");
    const result = categoria
      ? await env.DB.prepare("SELECT id,categoria,servicio,precio,descripcion,created_at,updated_at FROM precios WHERE categoria = ? ORDER BY servicio").bind(categoria).all()
      : await env.DB.prepare("SELECT id,categoria,servicio,precio,descripcion,created_at,updated_at FROM precios ORDER BY categoria,servicio").all();
    return json(request, env, { items: result.results || [] });
  }

  if (!authorized(request, env)) return error(request, env, "No autorizado: falta un token profesional válido.", 401);

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body || !validCategory(body.categoria) || typeof body.servicio !== "string" ||
        !body.servicio.trim() || body.servicio.length > 120 ||
        !Number.isFinite(Number(body.precio)) || Number(body.precio) < 0 ||
        (body.descripcion != null && (typeof body.descripcion !== "string" || body.descripcion.length > 1000))) {
      return error(request, env, "Datos inválidos. Se requiere categoria, servicio, precio y descripción opcional.");
    }
    try {
      const result = await env.DB.prepare(
        "INSERT INTO precios (categoria,servicio,precio,descripcion) VALUES (?,?,?,?) RETURNING id,categoria,servicio,precio,descripcion,created_at,updated_at"
      ).bind(body.categoria, body.servicio.trim(), Number(body.precio), body.descripcion || "").first();
      return json(request, env, { item: result }, 201);
    } catch (e) {
      return error(request, env, "No se pudo crear el precio. Puede existir ya ese servicio en la categoría.", 409);
    }
  }

  const id = Number(url.pathname.split("/").filter(Boolean).at(-1));
  if (!Number.isInteger(id) || id <= 0) return error(request, env, "ID de precio inválido.");
  if (request.method === "PUT") {
    const body = await readJson(request);
    if (!body || !validCategory(body.categoria) || typeof body.servicio !== "string" ||
        !body.servicio.trim() || body.servicio.length > 120 ||
        !Number.isFinite(Number(body.precio)) || Number(body.precio) < 0 ||
        (body.descripcion != null && (typeof body.descripcion !== "string" || body.descripcion.length > 1000))) {
      return error(request, env, "Datos inválidos para editar el precio.");
    }
    try {
      const item = await env.DB.prepare(
        "UPDATE precios SET categoria=?,servicio=?,precio=?,descripcion=?,updated_at=datetime('now') WHERE id=? RETURNING id,categoria,servicio,precio,descripcion,created_at,updated_at"
      ).bind(body.categoria, body.servicio.trim(), Number(body.precio), body.descripcion || "", id).first();
      return item ? json(request, env, { item }) : error(request, env, "Precio no encontrado.", 404);
    } catch {
      return error(request, env, "No se pudo actualizar: puede existir ya ese servicio en la categoría.", 409);
    }
  }
  if (request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM precios WHERE id=?").bind(id).run();
    return result.meta.changes ? json(request, env, { ok: true, id }) : error(request, env, "Precio no encontrado.", 404);
  }
  return error(request, env, "Método no permitido.", 405);
}

async function handleGaleria(request, env, url, parts) {
  const categoria = parts[2];
  if (!validCategory(categoria)) return error(request, env, "Categoría inválida.");
  const prefix = `galeria/${categoria}/`;

  if (request.method === "GET") {
    const listed = await env.GALERIA.list({ prefix, limit: 1000 });
    const items = (listed.objects || []).map(o => ({
      key: o.key,
      nombre: o.key.slice(prefix.length),
      url: `/api/galeria/${encodeURIComponent(categoria)}/archivo/${encodeURIComponent(o.key.slice(prefix.length))}`,
      size: o.size,
      uploaded: o.uploaded,
      contentType: o.httpMetadata?.contentType || null,
    }));
    return json(request, env, { categoria, items, hasMore: listed.truncated });
  }

  if (request.method === "POST") {
    if (!authorized(request, env)) return error(request, env, "No autorizado: falta un token profesional válido.", 401);
    const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return error(request, env, "Formato no admitido. Usá JPG, PNG, WEBP o AVIF.", 415);
    const declared = Number(request.headers.get("Content-Length") || 0);
    if (declared > MAX_IMAGE_BYTES) return error(request, env, "La imagen supera el límite de 8 MB.", 413);
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return error(request, env, "Archivo vacío o mayor a 8 MB.", 413);
    const name = safeFilename(url.searchParams.get("nombre") || request.headers.get("X-File-Name") || "muestra");
    const key = `${prefix}${Date.now()}-${crypto.randomUUID()}-${name}`;
    await env.GALERIA.put(key, bytes, { httpMetadata: { contentType } });
    return json(request, env, {
      item: { key, nombre: key.slice(prefix.length), url: `/api/galeria/${encodeURIComponent(categoria)}/archivo/${encodeURIComponent(key.slice(prefix.length))}` }
    }, 201);
  }

  if (request.method === "DELETE") {
    if (!authorized(request, env)) return error(request, env, "No autorizado: falta un token profesional válido.", 401);
    const key = url.searchParams.get("key");
    if (!key || !key.startsWith(prefix) || key.includes("..")) return error(request, env, "Clave de imagen inválida.");
    const object = await env.GALERIA.head(key);
    if (!object) return error(request, env, "Imagen no encontrada.", 404);
    await env.GALERIA.delete(key);
    return json(request, env, { ok: true, key });
  }
  return error(request, env, "Método no permitido.", 405);
}

async function serveImage(request, env, parts) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
  const categoria = parts[2];
  const filename = parts.slice(4).join("/");
  if (!validCategory(categoria) || !filename || filename.includes("..")) return new Response("Not found", { status: 404 });
  const object = await env.GALERIA.get(`galeria/${categoria}/${filename}`);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json(request, env, { ok: true, service: "corona-real-api" });
      }
      if (parts[0] === "api" && parts[1] === "precios") {
        return await handlePrecios(request, env, url);
      }
      if (parts[0] === "api" && parts[1] === "galeria" && parts[3] === "archivo") {
        return await serveImage(request, env, parts);
      }
      if (parts[0] === "api" && parts[1] === "galeria" && parts.length === 3) {
        return await handleGaleria(request, env, url, parts);
      }
      return error(request, env, "Ruta no encontrada.", 404);
    } catch (e) {
      return error(request, env, "Error interno del servidor.", 500);
    }
  }
};

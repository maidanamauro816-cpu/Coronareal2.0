-- Corona Real: catálogo editable de precios
CREATE TABLE IF NOT EXISTS precios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT NOT NULL,
  servicio TEXT NOT NULL,
  precio REAL NOT NULL CHECK (precio >= 0),
  descripcion TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_precios_categoria ON precios(categoria);
CREATE UNIQUE INDEX IF NOT EXISTS idx_precios_categoria_servicio ON precios(categoria, servicio);

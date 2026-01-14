import express from "express";
import session from "express-session";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

const ADMIN_PASSWORD = "1234"; // TROQUE DEPOIS

// middlewares
app.use(express.json());
app.use(session({
  secret: "setcineplus-secret",
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, "../public")));

// banco de dados
const db = new Database(path.join(__dirname, "data", "db.sqlite"));
db.prepare(`
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  thumbnail TEXT,
  source TEXT,
  type TEXT,
  category TEXT
)
`).run();

// proteção
function isAdmin(req, res, next) {
  if (req.session.admin) return next();
  return res.status(401).json({ error: "Não autorizado" });
}

// login
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Senha incorreta" });
});

// logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// listar vídeos (público)
app.get("/api/videos", (req, res) => {
  res.json(db.prepare("SELECT * FROM videos ORDER BY id DESC").all());
});

// buscar + filtrar (público)
app.get("/api/videos/search", (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  const category = (req.query.category || "Todos").trim();

  // base
  let sql = "SELECT * FROM videos";
  const where = [];
  const params = {};

  if (category && category !== "Todos") {
    where.push("category = @category");
    params.category = category;
  }

  if (q) {
    // busca por title (case-insensitive simples)
    where.push("LOWER(title) LIKE @q");
    params.q = `%${q}%`;
  }

  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY id DESC";

  res.json(db.prepare(sql).all(params));
});

// criar vídeo (protegido)
app.post("/api/videos", isAdmin, (req, res) => {
  const { title, thumbnail, source, type, category } = req.body;

  if (!title || !thumbnail || !source || !type || !category) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }

  db.prepare(
    "INSERT INTO videos (title, thumbnail, source, type, category) VALUES (?,?,?,?,?)"
  ).run(title, thumbnail, source, type, category);

  res.json({ ok: true });
});

// editar vídeo (protegido)
app.put("/api/videos/:id", isAdmin, (req, res) => {
  const { title, thumbnail, source, type, category } = req.body;

  db.prepare(`
    UPDATE videos
    SET title = ?, thumbnail = ?, source = ?, type = ?, category = ?
    WHERE id = ?
  `).run(title, thumbnail, source, type, category, req.params.id);

  res.json({ ok: true });
});

// excluir vídeo (protegido)
app.delete("/api/videos/:id", isAdmin, (req, res) => {
  db.prepare("DELETE FROM videos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("SETCINE PLUS rodando em http://localhost:" + PORT);
});

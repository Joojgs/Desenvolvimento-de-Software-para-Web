const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
const DB_SCRIPT = path.join(__dirname, "db.py");
const PYTHON_COMMANDS = process.platform === "win32" ? ["py", "python", "python3"] : ["python3", "python"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
  });
}

function db(action, payload = {}) {
  let result;
  for (const command of PYTHON_COMMANDS) {
    result = spawnSync(command, [DB_SCRIPT, action], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 10 * 1024 * 1024
    });
    if (result.error && result.error.code === "ENOENT") continue;
    break;
  }

  if (result?.error && result.error.code === "ENOENT") {
    throw new Error("Python não encontrado. Instale Python 3 ou habilite o comando py/python no Windows.");
  }

  const raw = result.stdout || result.stderr || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { error: raw.trim() || "Erro interno no banco de dados." };
  }

  if (result.status !== 0 || parsed.error) {
    const error = new Error(parsed.error || "Falha ao executar operação.");
    error.status = parsed.status || 400;
    throw error;
  }

  return parsed.data;
}

function idFromPath(pathname, base) {
  const match = pathname.match(new RegExp(`^${base}/(\\d+)$`));
  return match ? Number(match[1]) : null;
}

async function handleApi(req, res, url) {
  try {
    const pathname = url.pathname;
    const method = req.method;
    const query = Object.fromEntries(url.searchParams.entries());

    if (pathname === "/api/health" && method === "GET") {
      return sendJson(res, 200, { ok: true, app: "Controle Financeiro Pessoal" });
    }

    if (pathname === "/api/bootstrap" && method === "GET") {
      return sendJson(res, 200, db("bootstrap", query));
    }

    if (pathname === "/api/summary" && method === "GET") {
      return sendJson(res, 200, db("summary", query));
    }

    if (pathname === "/api/transactions" && method === "GET") {
      return sendJson(res, 200, db("list_transactions", query));
    }

    if (pathname === "/api/transactions" && method === "POST") {
      return sendJson(res, 201, db("create_transaction", await readBody(req)));
    }

    const transactionId = idFromPath(pathname, "/api/transactions");
    if (transactionId && method === "PUT") {
      return sendJson(res, 200, db("update_transaction", { id: transactionId, ...(await readBody(req)) }));
    }
    if (transactionId && method === "DELETE") {
      return sendJson(res, 200, db("delete_transaction", { id: transactionId }));
    }

    if (pathname === "/api/categories" && method === "GET") {
      return sendJson(res, 200, db("list_categories"));
    }
    if (pathname === "/api/categories" && method === "POST") {
      return sendJson(res, 201, db("create_category", await readBody(req)));
    }

    const categoryId = idFromPath(pathname, "/api/categories");
    if (categoryId && method === "PUT") {
      return sendJson(res, 200, db("update_category", { id: categoryId, ...(await readBody(req)) }));
    }
    if (categoryId && method === "DELETE") {
      return sendJson(res, 200, db("delete_category", { id: categoryId }));
    }

    if (pathname === "/api/budgets" && method === "GET") {
      return sendJson(res, 200, db("list_budgets", query));
    }
    if (pathname === "/api/budgets" && method === "POST") {
      return sendJson(res, 201, db("create_budget", await readBody(req)));
    }

    const budgetId = idFromPath(pathname, "/api/budgets");
    if (budgetId && method === "PUT") {
      return sendJson(res, 200, db("update_budget", { id: budgetId, ...(await readBody(req)) }));
    }
    if (budgetId && method === "DELETE") {
      return sendJson(res, 200, db("delete_budget", { id: budgetId }));
    }

    sendJson(res, 404, { error: "Rota não encontrada." });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message });
  }
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(FRONTEND, requested));

  if (!filePath.startsWith(FRONTEND)) {
    res.writeHead(403);
    return res.end("Acesso negado.");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(FRONTEND, "index.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(404);
          return res.end("Arquivo não encontrado.");
        }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(fallbackData);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300"
    });
    res.end(data);
  });
}

db("init");

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
  } else {
    serveStatic(req, res, url);
  }
});

server.listen(PORT, () => {
  console.log(`Controle Financeiro Pessoal rodando em http://localhost:${PORT}`);
});

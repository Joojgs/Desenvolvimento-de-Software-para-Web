import json
import re
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "finance.db"
VALID_TYPES = {"income", "expense"}


class AppError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows(cursor):
    return [dict(row) for row in cursor.fetchall()]


def one(cursor):
    row = cursor.fetchone()
    return dict(row) if row else None


def money(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise AppError("Valor financeiro inválido.")
    if value <= 0:
        raise AppError("O valor deve ser maior que zero.")
    return round(value, 2)


def required_text(payload, field, label):
    value = str(payload.get(field, "")).strip()
    if not value:
        raise AppError(f"{label} é obrigatório.")
    return value


def parse_type(value):
    if value not in VALID_TYPES:
        raise AppError("Tipo deve ser income ou expense.")
    return value


def parse_date(value):
    try:
        parsed = datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        raise AppError("Data deve estar no formato AAAA-MM-DD.")
    return parsed.isoformat()


def month_value(value=None):
    if not value:
        return date.today().strftime("%Y-%m")
    value = str(value)
    if not re.match(r"^\d{4}-\d{2}$", value):
        raise AppError("Mês deve estar no formato AAAA-MM.")
    return value


def next_month(month):
    year, mon = map(int, month.split("-"))
    if mon == 12:
        return f"{year + 1}-01"
    return f"{year}-{mon + 1:02d}"


def category_exists(conn, category_id, expected_type=None):
    category = one(conn.execute("SELECT * FROM categories WHERE id = ?", (category_id,)))
    if not category:
        raise AppError("Categoria não encontrada.", 404)
    if expected_type and category["type"] != expected_type:
        raise AppError("Categoria não pertence ao tipo informado.")
    return category


def init_db(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            color TEXT NOT NULL DEFAULT '#c58a28',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL CHECK (amount > 0),
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            category_id INTEGER NOT NULL,
            due_date TEXT NOT NULL,
            payment_method TEXT DEFAULT 'Pix',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            month TEXT NOT NULL,
            limit_amount REAL NOT NULL CHECK (limit_amount > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT,
            UNIQUE(category_id, month),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        """
    )
    seed_if_empty(conn)
    conn.commit()


def seed_if_empty(conn):
    count = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if count:
        return

    seed_categories = [
        ("Salário", "income", "#2f8f5b"),
        ("Freelance", "income", "#3a7d90"),
        ("Moradia", "expense", "#bf4a35"),
        ("Alimentação", "expense", "#c58a28"),
        ("Transporte", "expense", "#315d75"),
        ("Lazer", "expense", "#805d93"),
        ("Saúde", "expense", "#6c8d44"),
        ("Educação", "expense", "#8a6f48"),
    ]
    conn.executemany(
        "INSERT INTO categories (name, type, color) VALUES (?, ?, ?)",
        seed_categories,
    )

    ids = {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM categories")}
    month = date.today().strftime("%Y-%m")
    sample_transactions = [
        ("Salário mensal", 4200.00, "income", ids["Salário"], f"{month}-05", "Transferência", "Receita principal"),
        ("Projeto freelance", 850.00, "income", ids["Freelance"], f"{month}-12", "Pix", "Cliente avulso"),
        ("Aluguel", 1450.00, "expense", ids["Moradia"], f"{month}-06", "Transferência", ""),
        ("Mercado da semana", 382.75, "expense", ids["Alimentação"], f"{month}-10", "Débito", ""),
        ("Aplicativo de transporte", 96.40, "expense", ids["Transporte"], f"{month}-13", "Crédito", ""),
        ("Cinema e jantar", 168.90, "expense", ids["Lazer"], f"{month}-17", "Crédito", ""),
        ("Consulta médica", 210.00, "expense", ids["Saúde"], f"{month}-20", "Pix", ""),
    ]
    conn.executemany(
        """
        INSERT INTO transactions
        (description, amount, type, category_id, due_date, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        sample_transactions,
    )
    conn.executemany(
        "INSERT INTO budgets (category_id, month, limit_amount) VALUES (?, ?, ?)",
        [
            (ids["Moradia"], month, 1600.00),
            (ids["Alimentação"], month, 900.00),
            (ids["Transporte"], month, 420.00),
            (ids["Lazer"], month, 350.00),
            (ids["Saúde"], month, 500.00),
        ],
    )


def list_categories(conn, _payload=None):
    return rows(
        conn.execute(
            """
            SELECT id, name, type, color, created_at
            FROM categories
            ORDER BY CASE type WHEN 'income' THEN 0 ELSE 1 END, name
            """
        )
    )


def create_category(conn, payload):
    name = required_text(payload, "name", "Nome")
    category_type = parse_type(payload.get("type"))
    color = required_text(payload, "color", "Cor")
    try:
        cursor = conn.execute(
            "INSERT INTO categories (name, type, color) VALUES (?, ?, ?)",
            (name, category_type, color),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise AppError("Já existe uma categoria com esse nome.", 409)
    return one(conn.execute("SELECT * FROM categories WHERE id = ?", (cursor.lastrowid,)))


def update_category(conn, payload):
    category_id = int(payload.get("id") or 0)
    category_exists(conn, category_id)
    name = required_text(payload, "name", "Nome")
    category_type = parse_type(payload.get("type"))
    color = required_text(payload, "color", "Cor")
    try:
        conn.execute(
            """
            UPDATE categories
            SET name = ?, type = ?, color = ?
            WHERE id = ?
            """,
            (name, category_type, color, category_id),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise AppError("Já existe uma categoria com esse nome.", 409)
    return one(conn.execute("SELECT * FROM categories WHERE id = ?", (category_id,)))


def delete_category(conn, payload):
    category_id = int(payload.get("id") or 0)
    category_exists(conn, category_id)
    usage = conn.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM transactions WHERE category_id = ?) AS tx_count,
          (SELECT COUNT(*) FROM budgets WHERE category_id = ?) AS budget_count
        """,
        (category_id, category_id),
    ).fetchone()
    if usage["tx_count"] or usage["budget_count"]:
        raise AppError("Categoria em uso. Exclua transações/orçamentos vinculados antes.", 409)
    conn.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    conn.commit()
    return {"deleted": True}


def transaction_filters(payload):
    month = month_value(payload.get("month"))
    where = ["t.due_date >= ?", "t.due_date < ?"]
    params = [f"{month}-01", f"{next_month(month)}-01"]

    tx_type = payload.get("type")
    if tx_type:
        where.append("t.type = ?")
        params.append(parse_type(tx_type))

    q = str(payload.get("q", "")).strip().lower()
    if q:
        where.append("(LOWER(t.description) LIKE ? OR LOWER(t.notes) LIKE ? OR LOWER(c.name) LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])

    return " AND ".join(where), params


def list_transactions(conn, payload=None):
    payload = payload or {}
    where_sql, params = transaction_filters(payload)
    return rows(
        conn.execute(
            f"""
            SELECT
              t.id, t.description, t.amount, t.type, t.category_id, t.due_date,
              t.payment_method, t.notes, t.created_at, t.updated_at,
              c.name AS category, c.color
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE {where_sql}
            ORDER BY t.due_date DESC, t.id DESC
            """,
            params,
        )
    )


def transaction_payload(conn, payload):
    description = required_text(payload, "description", "Descrição")
    tx_type = parse_type(payload.get("type"))
    category_id = int(payload.get("category_id") or 0)
    category_exists(conn, category_id, tx_type)
    amount = money(payload.get("amount"))
    due_date = parse_date(payload.get("due_date"))
    payment_method = str(payload.get("payment_method", "Pix")).strip() or "Pix"
    notes = str(payload.get("notes", "")).strip()
    return description, amount, tx_type, category_id, due_date, payment_method, notes


def create_transaction(conn, payload):
    data = transaction_payload(conn, payload)
    cursor = conn.execute(
        """
        INSERT INTO transactions
        (description, amount, type, category_id, due_date, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        data,
    )
    conn.commit()
    return get_transaction(conn, cursor.lastrowid)


def get_transaction(conn, transaction_id):
    item = one(
        conn.execute(
            """
            SELECT t.*, c.name AS category, c.color
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE t.id = ?
            """,
            (transaction_id,),
        )
    )
    if not item:
        raise AppError("Transação não encontrada.", 404)
    return item


def update_transaction(conn, payload):
    transaction_id = int(payload.get("id") or 0)
    get_transaction(conn, transaction_id)
    data = transaction_payload(conn, payload)
    conn.execute(
        """
        UPDATE transactions
        SET description = ?, amount = ?, type = ?, category_id = ?, due_date = ?,
            payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (*data, transaction_id),
    )
    conn.commit()
    return get_transaction(conn, transaction_id)


def delete_transaction(conn, payload):
    transaction_id = int(payload.get("id") or 0)
    get_transaction(conn, transaction_id)
    conn.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
    conn.commit()
    return {"deleted": True}


def list_budgets(conn, payload=None):
    payload = payload or {}
    month = month_value(payload.get("month"))
    return rows(
        conn.execute(
            """
            SELECT b.id, b.category_id, b.month, b.limit_amount, b.created_at, b.updated_at,
                   c.name AS category, c.color
            FROM budgets b
            JOIN categories c ON c.id = b.category_id
            WHERE b.month = ?
            ORDER BY c.name
            """,
            (month,),
        )
    )


def budget_payload(conn, payload):
    category_id = int(payload.get("category_id") or 0)
    category_exists(conn, category_id, "expense")
    month = month_value(payload.get("month"))
    limit_amount = money(payload.get("limit_amount"))
    return category_id, month, limit_amount


def create_budget(conn, payload):
    data = budget_payload(conn, payload)
    try:
        cursor = conn.execute(
            "INSERT INTO budgets (category_id, month, limit_amount) VALUES (?, ?, ?)",
            data,
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise AppError("Já existe orçamento para essa categoria nesse mês.", 409)
    return get_budget(conn, cursor.lastrowid)


def get_budget(conn, budget_id):
    item = one(
        conn.execute(
            """
            SELECT b.*, c.name AS category, c.color
            FROM budgets b
            JOIN categories c ON c.id = b.category_id
            WHERE b.id = ?
            """,
            (budget_id,),
        )
    )
    if not item:
        raise AppError("Orçamento não encontrado.", 404)
    return item


def update_budget(conn, payload):
    budget_id = int(payload.get("id") or 0)
    get_budget(conn, budget_id)
    data = budget_payload(conn, payload)
    try:
        conn.execute(
            """
            UPDATE budgets
            SET category_id = ?, month = ?, limit_amount = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (*data, budget_id),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise AppError("Já existe orçamento para essa categoria nesse mês.", 409)
    return get_budget(conn, budget_id)


def delete_budget(conn, payload):
    budget_id = int(payload.get("id") or 0)
    get_budget(conn, budget_id)
    conn.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
    conn.commit()
    return {"deleted": True}


def summary(conn, payload=None):
    payload = payload or {}
    month = month_value(payload.get("month"))
    start = f"{month}-01"
    end = f"{next_month(month)}-01"

    totals = one(
        conn.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
            FROM transactions
            WHERE due_date >= ? AND due_date < ?
            """,
            (start, end),
        )
    )
    income = round(float(totals["income"]), 2)
    expense = round(float(totals["expense"]), 2)

    by_category = rows(
        conn.execute(
            """
            SELECT c.id AS category_id, c.name AS category, c.color,
                   ROUND(SUM(t.amount), 2) AS total
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE t.type = 'expense' AND t.due_date >= ? AND t.due_date < ?
            GROUP BY c.id, c.name, c.color
            ORDER BY total DESC
            """,
            (start, end),
        )
    )

    budget_progress = rows(
        conn.execute(
            """
            SELECT b.id, b.category_id, b.month, b.limit_amount,
                   c.name AS category, c.color,
                   COALESCE(ROUND(SUM(t.amount), 2), 0) AS spent
            FROM budgets b
            JOIN categories c ON c.id = b.category_id
            LEFT JOIN transactions t
              ON t.category_id = b.category_id
             AND t.type = 'expense'
             AND t.due_date >= ?
             AND t.due_date < ?
            WHERE b.month = ?
            GROUP BY b.id, b.category_id, b.month, b.limit_amount, c.name, c.color
            ORDER BY (spent / b.limit_amount) DESC
            """,
            (start, end, month),
        )
    )
    for item in budget_progress:
        item["percent"] = round((float(item["spent"]) / float(item["limit_amount"])) * 100, 2)

    return {
        "month": month,
        "income": income,
        "expense": expense,
        "balance": round(income - expense, 2),
        "by_category": by_category,
        "budget_progress": budget_progress,
    }


def bootstrap(conn, payload=None):
    payload = payload or {}
    return {
        "categories": list_categories(conn),
        "transactions": list_transactions(conn, payload),
        "budgets": list_budgets(conn, payload),
        "summary": summary(conn, payload),
    }


ACTIONS = {
    "init": lambda conn, payload: {"ready": True, "database": str(DB_PATH)},
    "bootstrap": bootstrap,
    "summary": summary,
    "list_categories": list_categories,
    "create_category": create_category,
    "update_category": update_category,
    "delete_category": delete_category,
    "list_transactions": list_transactions,
    "create_transaction": create_transaction,
    "update_transaction": update_transaction,
    "delete_transaction": delete_transaction,
    "list_budgets": list_budgets,
    "create_budget": create_budget,
    "update_budget": update_budget,
    "delete_budget": delete_budget,
}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    payload_text = sys.stdin.read().strip()
    payload = json.loads(payload_text) if payload_text else {}

    if action not in ACTIONS:
        raise AppError("Ação de banco inválida.", 404)

    with connect() as conn:
        init_db(conn)
        data = ACTIONS[action](conn, payload)
    print(json.dumps({"data": data}))


if __name__ == "__main__":
    try:
        main()
    except AppError as exc:
        print(json.dumps({"error": str(exc), "status": exc.status}))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"error": f"Erro interno: {exc}", "status": 500}))
        sys.exit(1)

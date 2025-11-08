# MicroSQL

> A lightweight, git-friendly SQL database that stores data as JSON files

**MicroSQL** is a zero-dependency database engine for JavaScript/TypeScript projects. Run SQL-like queries on JSON files without SQLite, Postgres, or any database server. Perfect for open source projects where you want users to clone and run immediately.

---

## Why MicroSQL?

- **Zero setup** - No database installation, no configuration files, just JSON
- **Git-friendly** - Human-readable diffs, easy to version control, no binary `.db` files
- **Zero dependencies** - Pure Node.js, works everywhere
- **Familiar syntax** - If you know SQL, you already know MicroSQL

---

## Installation

```bash
npm install microsql
```

Or with pnpm:

```bash
pnpm add microsql
```

---

## Quick Start

```typescript
import { MicroSQL } from "microsql";

const db = new MicroSQL("./data");

db.query(`INSERT INTO users (id, name, age, city) VALUES (1, "Alice", 25, "Berlin")`);
db.query(`INSERT INTO users (id, name, age, city) VALUES (2, "Bob", 30, "Paris")`);

const users = db.query(`SELECT * FROM users WHERE age > 20`);
console.log(users);
```

Each table is stored as `./data/users.json` - no database server required.

---

## Features

### Supported SQL Operations

| Feature | Example |
|---------|---------|
| **SELECT** | `SELECT name, age FROM users` |
| **INSERT** | `INSERT INTO users (id, name) VALUES (1, "Alice")` |
| **UPDATE** | `UPDATE users SET age = 26 WHERE name = "Alice"` |
| **DELETE** | `DELETE FROM users WHERE id = 1` |
| **WHERE** | `WHERE age > 25 AND city = "Berlin"` |
| **LIKE** | `WHERE email LIKE "%@gmail.com"` |
| **JOIN** | `JOIN orders ON users.id = orders.user_id WHERE users.age > 25` |
| **IN** | `WHERE id IN (1, 2, 3)` |
| **ORDER BY** | `ORDER BY age DESC` |
| **LIMIT** | `LIMIT 10` |

### WHERE Clause Operators

- **Comparison**: `=`, `>`, `<`, `>=`, `<=`
- **Pattern matching**: `LIKE` with `%` (any chars) and `_` (single char)
- **List membership**: `IN (value1, value2, ...)`
- **Logic**: `AND`, `OR` with parentheses support

---

## Examples

### Basic CRUD

```typescript
const db = new MicroSQL("./data");

db.query(`INSERT INTO products (id, name, price) VALUES (1, "Laptop", 999)`);

const products = db.query(`SELECT * FROM products`);

db.query(`UPDATE products SET price = 899 WHERE id = 1`);

db.query(`DELETE FROM products WHERE id = 1`);
```

### Filtering and Sorting

```typescript
db.query(`SELECT * FROM users WHERE age >= 18 AND city = "Berlin"`);

db.query(`SELECT name FROM users WHERE email LIKE "%@company.com"`);

db.query(`SELECT name FROM users WHERE id IN (1, 3, 5)`);

db.query(`SELECT name, age FROM users ORDER BY age DESC LIMIT 5`);
```

### Complex Queries

```typescript
db.query(`
  SELECT name, email 
  FROM users 
  WHERE (city = "Berlin" AND age > 25) OR status = "premium"
  ORDER BY name ASC
  LIMIT 10
`);
```

---

## Use Cases

MicroSQL is perfect for:

- **Open source projects** - Users can clone and run without database setup
- **Prototypes and demos** - Quick data persistence without infrastructure
- **CLI tools** - Store configuration and state in readable JSON
- **Static site generators** - Keep data in version control
- **Small applications** - Where SQLite is overkill

### When NOT to Use MicroSQL

- High-traffic production applications (no concurrency control)
- Large datasets (>10,000 rows per table)
- Applications requiring transactions or ACID guarantees
- Multi-user write scenarios (no locking mechanism)

---

## How It Works

1. Each table is stored as a separate JSON file (`./data/tablename.json`)
2. Queries are parsed with regex-based SQL parser
3. Operations load JSON, apply logic in-memory, and save back
4. No indexes or query optimization (trades performance for simplicity)

### File Structure

```
./data/
├── users.json
├── products.json
└── orders.json
```

Each JSON file contains an array of objects:

```json
[
  { "id": "1", "name": "Alice", "age": "25" },
  { "id": "2", "name": "Bob", "age": "30" }
]
```

## Limitations

- **No concurrency control** - Not safe for simultaneous writes
- **No indexes** - All queries are full table scans
- **Limited SQL** - Subset of SQL features only

---

## Roadmap

- [ ] GROUP BY and aggregate functions (COUNT, SUM, AVG)
- [ ] Type coercion (proper number/boolean handling)

---

## License

MIT

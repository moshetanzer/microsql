import { describe, it, expect, beforeEach } from "vitest";
import { MicroSQL } from "../src/index";
import { rmSync, mkdirSync, existsSync } from "fs";
import { afterAll, beforeAll } from "vitest";

const TEST_DIR = "./tmpdb";

beforeAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR);
});

afterAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("MicroSQL - Edge Cases", () => {
  let db: MicroSQL;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR);
    db = new MicroSQL(TEST_DIR);
  });

  it("handles commas in INSERT values", () => {
    db.query(`INSERT INTO users (id, name, bio) VALUES (1, "Smith, John", "Likes: coding, reading")`);
    
    const result = db.query(`SELECT * FROM users WHERE id = 1`) as { rows: any[] };
    expect(result.rows[0].name).toBe("Smith, John");
    expect(result.rows[0].bio).toBe("Likes: coding, reading");
  });

  it("handles commas in UPDATE values", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "John")`);
    db.query(`UPDATE users SET name = "Smith, John", bio = "Likes: coding, reading" WHERE id = 1`);
    
    const result = db.query(`SELECT * FROM users WHERE id = 1`) as { rows: any[] };
    expect(result.rows[0].name).toBe("Smith, John");
    expect(result.rows[0].bio).toBe("Likes: coding, reading");
  });

  it("handles commas in IN operator", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Smith, John")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Doe, Jane")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Bob")`);
    
    const result = db.query(`SELECT name FROM users WHERE name IN ("Smith, John", "Doe, Jane")`) as { rows: any[] };
    expect(result.rows.map(r => r.name).sort()).toEqual(["Doe, Jane", "Smith, John"]);
  });

  it("handles special regex characters in LIKE", () => {
    db.query(`INSERT INTO users (id, email) VALUES (1, "user@test.com")`);
    db.query(`INSERT INTO users (id, email) VALUES (2, "admin@example.org")`);
    
    const result = db.query(`SELECT email FROM users WHERE email LIKE "%@test.%"`) as { rows: any[] };
    expect(result.rows).toEqual([{ email: "user@test.com" }]);
  });

  it("handles numeric ORDER BY correctly", () => {
    db.query(`INSERT INTO products (id, price) VALUES (1, "100")`);
    db.query(`INSERT INTO products (id, price) VALUES (2, "20")`);
    db.query(`INSERT INTO products (id, price) VALUES (3, "5")`);
    
    const result = db.query(`SELECT price FROM products ORDER BY price DESC`) as { rows: any[] };
    expect(result.rows.map(r => r.price)).toEqual(["100", "20", "5"]);
  });

  it("handles string ORDER BY correctly", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Zara")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Bob")`);
    
    const result = db.query(`SELECT name FROM users ORDER BY name ASC`) as { rows: any[] };
    expect(result.rows.map(r => r.name)).toEqual(["Alice", "Bob", "Zara"]);
  });

  it("handles complex WHERE with mixed AND/OR", () => {
    db.query(`INSERT INTO users (id, name, age, city) VALUES (1, "Alice", 25, "Berlin")`);
    db.query(`INSERT INTO users (id, name, age, city) VALUES (2, "Bob", 30, "Paris")`);
    db.query(`INSERT INTO users (id, name, age, city) VALUES (3, "Carol", 35, "Berlin")`);
    db.query(`INSERT INTO users (id, name, age, city) VALUES (4, "Dave", 28, "London")`);
    
    const result = db.query(
      `SELECT name FROM users WHERE (city = "Berlin" AND age > 30) OR city = "Paris"`
    ) as { rows: any[] };
    expect(result.rows.map(r => r.name).sort()).toEqual(["Bob", "Carol"]);
  });

  it("handles UPDATE with multiple SET clauses", () => {
    db.query(`INSERT INTO users (id, name, age) VALUES (1, "Alice", 25)`);
    db.query(`UPDATE users SET name = "Alice Smith", age = 26 WHERE id = 1`);
    
    const result = db.query(`SELECT * FROM users WHERE id = 1`) as { rows: any[] };
    expect(result.rows[0].name).toBe("Alice Smith");
    expect(result.rows[0].age).toBe("26");
  });

  it("handles DELETE without WHERE clause", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    const deleteResult = db.query(`DELETE FROM users`) as { rowCount: number };
    expect(deleteResult.rowCount).toBe(2);
    
    const result = db.query(`SELECT * FROM users`) as { rows: any[] };
    expect(result.rows).toHaveLength(0);
  });

  it("handles empty table SELECT", () => {
    const result = db.query(`SELECT * FROM nonexistent`) as { rows: any[] };
    expect(result.rows).toEqual([]);
  });

  it("handles LIMIT without ORDER BY", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Carol")`);
    
    const result = db.query(`SELECT name FROM users LIMIT 2`) as { rows: any[] };
    expect(result.rows).toHaveLength(2);
  });

  it("handles WHERE with comparison operators", () => {
    db.query(`INSERT INTO products (id, price) VALUES (1, "10")`);
    db.query(`INSERT INTO products (id, price) VALUES (2, "20")`);
    db.query(`INSERT INTO products (id, price) VALUES (3, "30")`);
    
    const result1 = db.query(`SELECT id FROM products WHERE price >= 20`) as { rows: any[] };
    expect(result1.rows.map(r => r.id).sort()).toEqual(["2", "3"]);
    
    const result2 = db.query(`SELECT id FROM products WHERE price <= 20`) as { rows: any[] };
    expect(result2.rows.map(r => r.id).sort()).toEqual(["1", "2"]);
  });

  it("handles LIKE with underscore wildcard", () => {
    db.query(`INSERT INTO users (id, code) VALUES (1, "A1")`);
    db.query(`INSERT INTO users (id, code) VALUES (2, "A2")`);
    db.query(`INSERT INTO users (id, code) VALUES (3, "B1")`);
    
    const result = db.query(`SELECT code FROM users WHERE code LIKE "A_"`) as { rows: any[] };
    expect(result.rows.map(r => r.code).sort()).toEqual(["A1", "A2"]);
  });

  it("handles UPDATE that matches no rows", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    const result = db.query(`UPDATE users SET name = "Bob" WHERE id = 999`) as { rowCount: number };
    
    expect(result.rowCount).toBe(0);
    
    const check = db.query(`SELECT name FROM users WHERE id = 1`) as { rows: any[] };
    expect(check.rows[0].name).toBe("Alice");
  });

  it("handles SELECT with specific columns in different order", () => {
    db.query(`INSERT INTO users (id, name, age, city) VALUES (1, "Alice", 25, "Berlin")`);
    
    const result = db.query(`SELECT city, name FROM users WHERE id = 1`) as { rows: any[] };
    expect(result.rows[0]).toEqual({ city: "Berlin", name: "Alice" });
    expect(Object.keys(result.rows[0])).toEqual(["city", "name"]);
  });

  it("handles case-insensitive LIKE matching", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "ALICE")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Alice")`);
    
    const result = db.query(`SELECT name FROM users WHERE name LIKE "alice"`) as { rows: any[] };
    expect(result.rows).toHaveLength(3);
  });

  it("handles INNER JOIN", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (1, 1, "Laptop")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (2, 1, "Mouse")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (3, 2, "Keyboard")`);

    const result = db.query(
      `SELECT users.name, orders.product FROM users JOIN orders ON users.id = orders.user_id`
    ) as { rows: any[] };
    
    expect(result.rows).toHaveLength(3);
    expect(result.rows).toEqual([
      { "users.name": "Alice", "orders.product": "Laptop" },
      { "users.name": "Alice", "orders.product": "Mouse" },
      { "users.name": "Bob", "orders.product": "Keyboard" }
    ]);
  });

  it("handles INNER JOIN with INNER keyword", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (1, 1, "Laptop")`);

    const result = db.query(
      `SELECT users.name, orders.product FROM users INNER JOIN orders ON users.id = orders.user_id`
    ) as { rows: any[] };
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ "users.name": "Alice", "orders.product": "Laptop" });
  });

  it("handles LEFT JOIN", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Carol")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (1, 1, "Laptop")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (2, 1, "Mouse")`);

    const result = db.query(
      `SELECT users.name, orders.product FROM users LEFT JOIN orders ON users.id = orders.user_id`
    ) as { rows: any[] };
    
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map(r => r["users.name"]).sort()).toEqual(["Alice", "Alice", "Bob", "Carol"]);
    
    const bobOrder = result.rows.find(r => r["users.name"] === "Bob");
    expect(bobOrder!["orders.product"]).toBeUndefined();
  });

  it("handles JOIN with WHERE clause", () => {
    db.query(`INSERT INTO users (id, name, age) VALUES (1, "Alice", 25)`);
    db.query(`INSERT INTO users (id, name, age) VALUES (2, "Bob", 30)`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (1, 1, "Laptop")`);
    db.query(`INSERT INTO orders (id, user_id, product) VALUES (2, 2, "Mouse")`);

    const result = db.query(
      `SELECT users.name, orders.product FROM users JOIN orders ON users.id = orders.user_id WHERE users.age > 25`
    ) as { rows: any[] };
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ "users.name": "Bob", "orders.product": "Mouse" });
  });

  it("handles JOIN with ORDER BY and LIMIT", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    db.query(`INSERT INTO orders (id, user_id, product, price) VALUES (1, 1, "Laptop", 1000)`);
    db.query(`INSERT INTO orders (id, user_id, product, price) VALUES (2, 1, "Mouse", 20)`);
    db.query(`INSERT INTO orders (id, user_id, product, price) VALUES (3, 2, "Keyboard", 50)`);

    const result = db.query(
      `SELECT users.name, orders.product, orders.price FROM users JOIN orders ON users.id = orders.user_id ORDER BY orders.price DESC LIMIT 2`
    ) as { rows: any[] };
    
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]["orders.product"]).toBe("Laptop");
    expect(result.rows[1]["orders.product"]).toBe("Keyboard");
  });

  it("returns correct INSERT result format", () => {
    const result = db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`) as { rows: any[]; rowCount: number };
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ id: "1", name: "Alice" });
    expect(result.rowCount).toBe(1);
  });

  it("returns correct UPDATE result format", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    
    const result = db.query(`UPDATE users SET name = "Updated" WHERE id = 1`) as { rows: any[]; rowCount: number };
    
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(1);
  });

  it("returns correct DELETE result format", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    
    const result = db.query(`DELETE FROM users WHERE id = 1`) as { rows: any[]; rowCount: number };
    
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(1);
  });
});
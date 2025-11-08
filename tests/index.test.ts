import { describe, it, expect, beforeEach } from "vitest";
import { MicroDB } from "../src/index";
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

describe("MicroDB - Edge Cases", () => {
  let db: MicroDB;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR);
    db = new MicroDB(TEST_DIR);
  });

  it("handles commas in INSERT values", () => {
    db.query(`INSERT INTO users (id, name, bio) VALUES (1, "Smith, John", "Likes: coding, reading")`);
    
    const result = db.query(`SELECT * FROM users WHERE id = 1`);
    expect(result[0].name).toBe("Smith, John");
    expect(result[0].bio).toBe("Likes: coding, reading");
  });

  it("handles commas in UPDATE values", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "John")`);
    db.query(`UPDATE users SET name = "Smith, John", bio = "Likes: coding, reading" WHERE id = 1`);
    
    const result = db.query(`SELECT * FROM users WHERE id = 1`);
    expect(result[0].name).toBe("Smith, John");
    expect(result[0].bio).toBe("Likes: coding, reading");
  });

  it("handles commas in IN operator", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Smith, John")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Doe, Jane")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Bob")`);
    
    const result = db.query(`SELECT name FROM users WHERE name IN ("Smith, John", "Doe, Jane")`);
    expect(result.map(r => r.name).sort()).toEqual(["Doe, Jane", "Smith, John"]);
  });

  it("handles special regex characters in LIKE", () => {
    db.query(`INSERT INTO users (id, email) VALUES (1, "user@test.com")`);
    db.query(`INSERT INTO users (id, email) VALUES (2, "admin@example.org")`);
    
    const result = db.query(`SELECT email FROM users WHERE email LIKE "%@test.%"`);
    expect(result).toEqual([{ email: "user@test.com" }]);
  });

  it("handles numeric ORDER BY correctly", () => {
    db.query(`INSERT INTO products (id, price) VALUES (1, "100")`);
    db.query(`INSERT INTO products (id, price) VALUES (2, "20")`);
    db.query(`INSERT INTO products (id, price) VALUES (3, "5")`);
    
    const result = db.query(`SELECT price FROM products ORDER BY price DESC`);
    expect(result.map(r => r.price)).toEqual(["100", "20", "5"]);
  });

  it("handles string ORDER BY correctly", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Zara")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Bob")`);
    
    const result = db.query(`SELECT name FROM users ORDER BY name ASC`);
    expect(result.map(r => r.name)).toEqual(["Alice", "Bob", "Zara"]);
  });

  it("handles complex WHERE with mixed AND/OR", () => {
    db.query(`INSERT INTO users (id, name, age, city) VALUES (1, "Alice", 25, "Berlin")`);
    db.query(`INSERT INTO users (id, name, age, city) VALUES (2, "Bob", 30, "Paris")`);
    db.query(`INSERT INTO users (id, name, age, city) VALUES (3, "Carol", 35, "Berlin")`);
    db.query(`INSERT INTO users (id, name, age, city) VALUES (4, "Dave", 28, "London")`);
    
    const result = db.query(
      `SELECT name FROM users WHERE (city = "Berlin" AND age > 30) OR city = "Paris"`
    );
    expect(result.map(r => r.name).sort()).toEqual(["Bob", "Carol"]);
  });

  it("handles UPDATE with multiple SET clauses", () => {
    db.query(`INSERT INTO users (id, name, age) VALUES (1, "Alice", 25)`);
    db.query(`UPDATE users SET name = "Alice Smith", age = 26 WHERE id = 1`);
    
    const result = db.query(`SELECT * FROM users WHERE id = 1`);
    expect(result[0].name).toBe("Alice Smith");
    expect(result[0].age).toBe("26");
  });

  it("handles DELETE without WHERE clause", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    db.query(`DELETE FROM users`);
    
    const result = db.query(`SELECT * FROM users`);
    expect(result).toHaveLength(0);
  });

  it("handles empty table SELECT", () => {
    const result = db.query(`SELECT * FROM nonexistent`);
    expect(result).toEqual([]);
  });

  it("handles LIMIT without ORDER BY", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "Bob")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Carol")`);
    
    const result = db.query(`SELECT name FROM users LIMIT 2`);
    expect(result).toHaveLength(2);
  });

  it("handles WHERE with comparison operators", () => {
    db.query(`INSERT INTO products (id, price) VALUES (1, "10")`);
    db.query(`INSERT INTO products (id, price) VALUES (2, "20")`);
    db.query(`INSERT INTO products (id, price) VALUES (3, "30")`);
    
    const result1 = db.query(`SELECT id FROM products WHERE price >= 20`);
    expect(result1.map(r => r.id).sort()).toEqual(["2", "3"]);
    
    const result2 = db.query(`SELECT id FROM products WHERE price <= 20`);
    expect(result2.map(r => r.id).sort()).toEqual(["1", "2"]);
  });

  it("handles LIKE with underscore wildcard", () => {
    db.query(`INSERT INTO users (id, code) VALUES (1, "A1")`);
    db.query(`INSERT INTO users (id, code) VALUES (2, "A2")`);
    db.query(`INSERT INTO users (id, code) VALUES (3, "B1")`);
    
    const result = db.query(`SELECT code FROM users WHERE code LIKE "A_"`);
    expect(result.map(r => r.code).sort()).toEqual(["A1", "A2"]);
  });

  it("handles UPDATE that matches no rows", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "Alice")`);
    const result = db.query(`UPDATE users SET name = "Bob" WHERE id = 999`);
    
    expect(result.updated).toBe(0);
    
    const check = db.query(`SELECT name FROM users WHERE id = 1`);
    expect(check[0].name).toBe("Alice");
  });

  it("handles SELECT with specific columns in different order", () => {
    db.query(`INSERT INTO users (id, name, age, city) VALUES (1, "Alice", 25, "Berlin")`);
    
    const result = db.query(`SELECT city, name FROM users WHERE id = 1`);
    expect(result[0]).toEqual({ city: "Berlin", name: "Alice" });
    expect(Object.keys(result[0])).toEqual(["city", "name"]);
  });

  it("handles case-insensitive LIKE matching", () => {
    db.query(`INSERT INTO users (id, name) VALUES (1, "alice")`);
    db.query(`INSERT INTO users (id, name) VALUES (2, "ALICE")`);
    db.query(`INSERT INTO users (id, name) VALUES (3, "Alice")`);
    
    const result = db.query(`SELECT name FROM users WHERE name LIKE "alice"`);
    expect(result).toHaveLength(3);
  });
});
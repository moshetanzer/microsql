import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

type Row = Record<string, any>;

export class MicroSQL {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private tablePath(table: string) {
    return path.join(this.dir, `${table}.json`);
  }

  private load(table: string): Row[] {
    const p = this.tablePath(table);
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8"));
  }

  private save(table: string, data: Row[]) {
    writeFileSync(this.tablePath(table), JSON.stringify(data, null, 2));
  }

  query(sql: string): any {
    sql = sql.trim();
    const [cmd] = sql.split(/\s+/);
    const command = cmd.toUpperCase();

    if (command === "SELECT") return this.select(sql);
    if (command === "INSERT") return this.insert(sql);
    if (command === "DELETE") return this.delete(sql);
    if (command === "UPDATE") return this.update(sql);

    throw new Error(`Unsupported SQL: ${command}`);
  }

  private select(sql: string) {
    const match = sql.match(
      /SELECT (.+?) FROM (\w+)(?: WHERE (.*?))?(?: ORDER BY (\w+)(?: (ASC|DESC))?)?(?: LIMIT (\d+))?$/i
    );
    if (!match) throw new Error("Invalid SELECT syntax");

    const [, columns, table, whereClause, orderField, orderDir, limitStr] = match;
    let rows = this.load(table);

    if (whereClause) {
      rows = rows.filter(row => this.evalWhere(whereClause, row));
    }

    if (orderField) {
      rows.sort((a, b) => {
        const aVal = this.coerceValue(a[orderField]);
        const bVal = this.coerceValue(b[orderField]);
        
        if (aVal < bVal) return orderDir?.toUpperCase() === "DESC" ? 1 : -1;
        if (aVal > bVal) return orderDir?.toUpperCase() === "DESC" ? -1 : 1;
        return 0;
      });
    }

    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      rows = rows.slice(0, limit);
    }

    if (columns.trim() !== "*") {
      const fields = columns.split(",").map(f => f.trim());
      rows = rows.map(r => {
        const obj: Row = {};
        for (const f of fields) obj[f] = r[f];
        return obj;
      });
    }

    return rows;
  }

  private coerceValue(val: any): any {
    if (val === null || val === undefined) return val;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }

  private insert(sql: string) {
    const match = sql.match(
      /INSERT INTO (\w+)\s*\((.+?)\)\s*VALUES\s*\((.+)\)/i
    );
    if (!match) throw new Error("Invalid INSERT syntax");

    const [, table, cols, vals] = match;
    const columns = this.splitRespectingQuotes(cols);
    const values = this.splitRespectingQuotes(vals).map(v => 
      v.replace(/^["']|["']$/g, "")
    );

    const row: Row = {};
    columns.forEach((c, i) => (row[c] = values[i]));

    const data = this.load(table);
    data.push(row);
    this.save(table, data);

    return row;
  }

  private delete(sql: string) {
    const match = sql.match(/DELETE FROM (\w+)(?: WHERE (.+))?$/i);
    if (!match) throw new Error("Invalid DELETE syntax");

    const [, table, whereClause] = match;
    let data = this.load(table);

    if (whereClause) {
      data = data.filter(row => !this.evalWhere(whereClause, row));
    } else {
      data = [];
    }

    this.save(table, data);
  }

  private update(sql: string) {
    const match = sql.match(/UPDATE (\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (!match) throw new Error("Invalid UPDATE syntax");

    const [, table, setClause, whereClause] = match;
    let data = this.load(table);

    const updates: Record<string, any> = {};
    const pairs = this.splitRespectingQuotes(setClause);
    
    pairs.forEach(pair => {
      const eqIndex = pair.indexOf("=");
      if (eqIndex === -1) return;
      
      const key = pair.substring(0, eqIndex).trim();
      const value = pair.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
      updates[key] = value;
    });

    let count = 0;

    data = data.map(row => {
      if (!whereClause || this.evalWhere(whereClause, row)) {
        count++;
        return { ...row, ...updates };
      }
      return row;
    });

    this.save(table, data);

    return { updated: count };
  }

  private splitRespectingQuotes(str: string, delimiter: string = ","): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
        current += char;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  private evalWhere(whereClause: string, row: Row): boolean {
    const orParts = this.splitLogicalOperator(whereClause, "OR");
    return orParts.some(orPart => {
      let cleanedOrPart = orPart.trim();
      while (cleanedOrPart.startsWith("(") && cleanedOrPart.endsWith(")")) {
        cleanedOrPart = cleanedOrPart.slice(1, -1).trim();
      }
      
      const andParts = this.splitLogicalOperator(cleanedOrPart, "AND");
      return andParts.every(expr => {
        let cleaned = expr.trim();
        while (cleaned.startsWith("(") && cleaned.endsWith(")")) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        return this.evalCondition(cleaned, row);
      });
    });
  }

  private splitLogicalOperator(clause: string, operator: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    let depth = 0;

    const regex = new RegExp(`\\s+${operator}\\s+`, "i");

    for (let i = 0; i < clause.length; i++) {
      const char = clause[i];

      if ((char === '"' || char === "'") && !inQuotes && (i === 0 || clause[i - 1] !== "\\")) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes && (i === 0 || clause[i - 1] !== "\\")) {
        inQuotes = false;
        quoteChar = "";
      } else if (char === "(" && !inQuotes) {
        depth++;
      } else if (char === ")" && !inQuotes) {
        depth--;
      }

      if (!inQuotes && depth === 0) {
        const remaining = clause.substring(i);
        const match = remaining.match(regex);
        
        if (match && match.index === 0) {
          parts.push(current.trim());
          current = "";
          i += match[0].length - 1;
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts.length > 0 ? parts : [clause];
  }

  private evalCondition(expr: string, row: Row): boolean {
    const match = expr.match(
      /(\w+)\s*(=|>=|<=|>|<|LIKE|IN)\s*(\([^\)]+\)|["'][^"']*["']|\S+)/i
    );
    if (!match) return false;
    
    const [, field, op, rawValue] = match;
    const actual = row[field];

    switch (op.toUpperCase()) {
      case "=": {
        const value = rawValue.replace(/^["']|["']$/g, "");
        return actual == value;
      }
      case ">": 
        return parseFloat(actual) > parseFloat(rawValue);
      case "<": 
        return parseFloat(actual) < parseFloat(rawValue);
      case ">=": 
        return parseFloat(actual) >= parseFloat(rawValue);
      case "<=": 
        return parseFloat(actual) <= parseFloat(rawValue);
      case "LIKE": {
        const value = rawValue.replace(/^["']|["']$/g, "");
        const pattern = "^" + value
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/%/g, ".*")
          .replace(/_/g, ".") + "$";
        const regex = new RegExp(pattern, "i");
        return regex.test(String(actual));
      }
      case "IN": {
        const innerContent = rawValue.replace(/^\(|\)$/g, "");
        const list = this.splitRespectingQuotes(innerContent).map(v => 
          v.replace(/^["']|["']$/g, "")
        );
        return list.includes(String(actual));
      }
      default: 
        return false;
    }
  }
}
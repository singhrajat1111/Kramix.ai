"""
Database Migration Runner for Kramix V2.
Applies schema version scripts to relational databases deterministically.
"""
from __future__ import annotations
import logging
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("kramix.migrations")


class MigrationRunner:
    """
    Executes ordered SQL migration scripts from the migrations directory.
    """

    def __init__(self, migrations_dir: Optional[Path] = None):
        self.migrations_dir = migrations_dir or Path(__file__).parent

    def get_migration_files(self) -> List[Path]:
        """Returns sorted list of .sql migration files."""
        if not self.migrations_dir.exists():
            return []
        files = list(self.migrations_dir.glob("*.sql"))
        return sorted(files, key=lambda p: p.name)

    def load_migration_sql(self, file_path: Path) -> str:
        """Reads SQL content from a migration file."""
        return file_path.read_text(encoding="utf-8")

    def parse_statements(self, sql: str) -> List[str]:
        """Parses a multi-statement SQL script into individual executable statements."""
        statements = []
        raw_stmts = sql.split(";")
        for stmt in raw_stmts:
            cleaned = stmt.strip()
            # Remove comment-only blocks
            lines = [l for l in cleaned.splitlines() if not l.strip().startswith("--")]
            uncommented = "\n".join(lines).strip()
            if uncommented:
                statements.append(uncommented)
        return statements

    def validate_migration_ddl(self, sql: str) -> dict:
        """Validates that migration SQL contains expected tables, constraints, and indexes."""
        statements = self.parse_statements(sql)
        tables_found = []
        indexes_found = []
        constraints_found = []

        for stmt in statements:
            upper = stmt.upper()
            if "CREATE TABLE" in upper:
                # Extract table name
                parts = stmt.split()
                try:
                    tbl_idx = [i for i, p in enumerate(parts) if p.upper() == "TABLE"][0] + 1
                    if parts[tbl_idx].upper() == "IF" and parts[tbl_idx + 1].upper() == "NOT" and parts[tbl_idx + 2].upper() == "EXISTS":
                        tbl_name = parts[tbl_idx + 3].split("(")[0].strip()
                    else:
                        tbl_name = parts[tbl_idx].split("(")[0].strip()
                    tables_found.append(tbl_name)
                except Exception:
                    pass
            if "CREATE INDEX" in upper:
                indexes_found.append(stmt)
            if "CONSTRAINT" in upper or "FOREIGN KEY" in upper or "UNIQUE" in upper or "REFERENCES" in upper:
                constraints_found.append(stmt)

        return {
            "total_statements": len(statements),
            "tables": tables_found,
            "indexes_count": len(indexes_found),
            "constraints_count": len(constraints_found),
            "is_valid": len(tables_found) >= 5,
        }


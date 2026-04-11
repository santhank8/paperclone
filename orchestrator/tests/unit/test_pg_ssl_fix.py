"""Tests for TRA-52: PostgreSQL checkpointer SSL fix.

Validates that _ensure_ssl_mode correctly appends sslmode=require
to connection strings in both URI and DSN formats.
"""

from src.main import _ensure_ssl_mode


class TestEnsureSslMode:
    def test_uri_without_params_gets_sslmode(self) -> None:
        conn = "postgresql://user:pass@host:5432/db"
        result = _ensure_ssl_mode(conn)
        assert result == "postgresql://user:pass@host:5432/db?sslmode=require"

    def test_uri_with_existing_params_appends_sslmode(self) -> None:
        conn = "postgresql://user:pass@host:5432/db?application_name=squad"
        result = _ensure_ssl_mode(conn)
        assert result == "postgresql://user:pass@host:5432/db?application_name=squad&sslmode=require"

    def test_uri_already_has_sslmode_unchanged(self) -> None:
        conn = "postgresql://user:pass@host:5432/db?sslmode=verify-full"
        result = _ensure_ssl_mode(conn)
        assert result == conn  # No change

    def test_postgres_scheme_handled(self) -> None:
        conn = "postgres://user:pass@host/db"
        result = _ensure_ssl_mode(conn)
        assert result == "postgres://user:pass@host/db?sslmode=require"

    def test_dsn_format_gets_sslmode(self) -> None:
        conn = "host=localhost port=5432 dbname=squad user=langgraph_user"
        result = _ensure_ssl_mode(conn)
        assert result == "host=localhost port=5432 dbname=squad user=langgraph_user sslmode=require"

    def test_dsn_already_has_sslmode_unchanged(self) -> None:
        conn = "host=localhost sslmode=require user=langgraph_user"
        result = _ensure_ssl_mode(conn)
        assert result == conn  # No change

    def test_empty_string_returns_sslmode(self) -> None:
        result = _ensure_ssl_mode("")
        assert result == " sslmode=require"

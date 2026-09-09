import os
import io
import json
import sqlite3
from contextlib import contextmanager
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import pandas as pd


class CacheManager:
    """SQLite-backed caching manager for financial data & raw HTTP response blobs."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            cache_dir = os.path.join(base_dir, "cache")
            os.makedirs(cache_dir, exist_ok=True)
            db_path = os.path.join(cache_dir, "financial_cache.db")

        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS company_info (
                    ticker TEXT PRIMARY KEY,
                    json_data TEXT,
                    updated_at TIMESTAMP
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS financial_statements (
                    ticker TEXT,
                    period_type TEXT,
                    json_data TEXT,
                    updated_at TIMESTAMP,
                    PRIMARY KEY (ticker, period_type)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS price_history (
                    ticker TEXT,
                    period TEXT,
                    json_data TEXT,
                    updated_at TIMESTAMP,
                    PRIMARY KEY (ticker, period)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS raw_url_cache (
                    url TEXT PRIMARY KEY,
                    json_data TEXT,
                    updated_at TIMESTAMP
                )
                """
            )
            conn.commit()

    def get_url_cache(self, url: str) -> Optional[Any]:
        """Retrieve raw HTTP JSON response from cache."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT json_data FROM raw_url_cache WHERE url = ?",
                (url,),
            )
            row = cursor.fetchone()
            if row and row[0]:
                try:
                    data = json.loads(row[0])
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except Exception:
                            pass
                    return data
                except Exception:
                    return row[0]
        return None

    def save_url_cache(self, url: str, data: Any):
        """Save raw HTTP JSON response to cache permanently."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if isinstance(data, str):
                try:
                    json_obj = json.loads(data)
                    json_str = json.dumps(json_obj)
                except Exception:
                    json_str = json.dumps(data)
            else:
                json_str = json.dumps(data)
            cursor.execute(
                """
                INSERT OR REPLACE INTO raw_url_cache (url, json_data, updated_at)
                VALUES (?, ?, ?)
                """,
                (url, json_str, datetime.now().isoformat()),
            )
            conn.commit()

    def get_company_info(self, ticker: str, max_age_hours: int = 24) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT json_data, updated_at FROM company_info WHERE ticker = ?",
                (ticker.upper(),),
            )
            row = cursor.fetchone()
            if row:
                json_data, updated_at = row
                updated_dt = datetime.fromisoformat(updated_at)
                if datetime.now() - updated_dt < timedelta(hours=max_age_hours):
                    return json.loads(json_data)
        return None

    def save_company_info(self, ticker: str, data: Dict[str, Any]):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO company_info (ticker, json_data, updated_at)
                VALUES (?, ?, ?)
                """,
                (ticker.upper(), json.dumps(data), datetime.now().isoformat()),
            )
            conn.commit()

    def get_financial_statements(
        self, ticker: str, period_type: str, max_age_hours: int = 24
    ) -> Optional[List[Dict[str, Any]]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT json_data, updated_at FROM financial_statements
                WHERE ticker = ? AND period_type = ?
                """,
                (ticker.upper(), period_type.lower()),
            )
            row = cursor.fetchone()
            if row:
                json_data, updated_at = row
                updated_dt = datetime.fromisoformat(updated_at)
                if datetime.now() - updated_dt < timedelta(hours=max_age_hours):
                    return json.loads(json_data)
        return None

    def save_financial_statements(
        self, ticker: str, period_type: str, statements: List[Dict[str, Any]]
    ):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO financial_statements (ticker, period_type, json_data, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    ticker.upper(),
                    period_type.lower(),
                    json.dumps(statements),
                    datetime.now().isoformat(),
                ),
            )
            conn.commit()

    def get_price_history(
        self, ticker: str, period: str, max_age_hours: int = 4
    ) -> Optional[pd.DataFrame]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT json_data, updated_at FROM price_history
                WHERE ticker = ? AND period = ?
                """,
                (ticker.upper(), period.lower()),
            )
            row = cursor.fetchone()
            if row:
                json_data, updated_at = row
                updated_dt = datetime.fromisoformat(updated_at)
                if datetime.now() - updated_dt < timedelta(hours=max_age_hours):
                    try:
                        return pd.read_json(io.StringIO(json_data), orient="split")
                    except Exception:
                        return None
        return None

    def save_price_history(self, ticker: str, period: str, df: pd.DataFrame):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            df_to_save = df.copy()
            df_to_save.index = df_to_save.index.astype(str)
            cursor.execute(
                """
                INSERT OR REPLACE INTO price_history (ticker, period, json_data, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    ticker.upper(),
                    period.lower(),
                    df_to_save.to_json(orient="split"),
                    datetime.now().isoformat(),
                ),
            )
            conn.commit()

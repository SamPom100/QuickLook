import os
from pathlib import Path


def _load_env_file():
    """Load key-value pairs from .env if it exists in project root."""
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass


_load_env_file()

ALPHAVANTAGE_KEY = os.environ.get("ALPHAVANTAGE_KEY") or os.environ.get("ALPHAVANTAGE_API_KEY") or ""


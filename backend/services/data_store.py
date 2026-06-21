"""JSON file based data cache layer."""

import json
from pathlib import Path
from typing import Optional

from models.schemas import MonthlyData


class DataStore:
    def __init__(self, history_dir: Path):
        self.history_dir = Path(history_dir)
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.history_dir / "index.json"
        self._index_cache: list[str] | None = None

    def get_month(self, month: str) -> Optional[MonthlyData]:
        path = self._month_path(month)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return MonthlyData.from_dict(json.load(f))

    def save_month(self, month: str, data: MonthlyData):
        path = self._month_path(month)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data.to_dict(), f, ensure_ascii=False, indent=2)
        self._index_cache = None

    def get_history(self) -> list[str]:
        if self._index_cache is not None:
            return self._index_cache
        if self.index_file.exists():
            with open(self.index_file, "r", encoding="utf-8") as f:
                self._index_cache = json.load(f)
        else:
            self._index_cache = self._scan_months()
        return self._index_cache

    def rebuild_index(self):
        months = self._scan_months()
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(months, f, ensure_ascii=False, indent=2)
        self._index_cache = months

    def _month_path(self, month: str) -> Path:
        safe_name = month.replace(".", "_")
        return self.history_dir / f"{safe_name}.json"

    def get_all_months(self, months: list[str] | None = None) -> dict[str, Optional[MonthlyData]]:
        """Batch-load multiple months at once (avoids N+1 reads in loops)."""
        if months is None:
            months = self.get_history()
        result: dict[str, Optional[MonthlyData]] = {}
        for month in months:
            path = self._month_path(month)
            if not path.exists():
                result[month] = None
                continue
            with open(path, "r", encoding="utf-8") as f:
                result[month] = MonthlyData.from_dict(json.load(f))
        return result

    def _scan_months(self) -> list[str]:
        months = []
        for f in self.history_dir.glob("*.json"):
            if f.name == "index.json":
                continue
            month = f.stem.replace("_", ".")
            months.append(month)
        return sorted(months)

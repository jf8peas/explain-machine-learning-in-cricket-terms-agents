"""A fingerprint of the app's data, so a stored recording of a run can tell when the data has been rebuilt. App-specific.

It covers the data manifest (the download date, the sources and the counts it records) and the size of each data file, which
changes whenever `scripts/prepare_data.py` writes different rows. A recorded run carries the value it was made against;
`tests/test_recorded_run.py` fails when the two differ.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DATA_FILES = ("innings.csv", "overs.csv")
MANIFEST = "manifest.json"


def data_fingerprint(data_dir: str | Path | None = None) -> str:
    """"sha256:" and the hex digest over the manifest's bytes and the size of each data file, in a fixed order."""
    folder = Path(data_dir) if data_dir else DATA_DIR
    digest = hashlib.sha256()
    digest.update((folder / MANIFEST).read_bytes())
    for name in DATA_FILES:
        digest.update(f"\n{name}:{(folder / name).stat().st_size}".encode("utf-8"))
    return f"sha256:{digest.hexdigest()}"

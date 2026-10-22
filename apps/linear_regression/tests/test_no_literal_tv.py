"""Feature 023: no sentence, comment or docstring in the backend calls the yardstick "TV". Identifiers (term id `tv`, fact
names such as `tv_gap`, dict keys) keep their names; only the word, in capitals, as a word, is looked for. The old name is kept
in one place so a reply that still uses it can be tested: the fake model's `old_name` option."""
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend" / "linreg"
WORD = re.compile(r"\bTV\b")
ALLOWED = {"llm_fake.py": "the old name, kept so the reply check can be tested against it",
           "methods.py": "the banned patterns themselves"}


def test_no_backend_source_says_tv_as_a_word():
    offenders = []
    for path in sorted(BACKEND.glob("*.py")):
        if path.name in ALLOWED:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if WORD.search(line):
                offenders.append(f"{path.name}:{number}: {line.strip()[:80]}")
    assert offenders == []

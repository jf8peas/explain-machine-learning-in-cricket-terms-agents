"""Checking the language model's wording for the "In cricket terms" section (feature 012). App-specific.

The model is asked for titles and sentences that name facts in braces, for example "each wicket costs {wicket_cost}
runs", and never write a number. This module decides what, if anything, of its reply may be shown:

- The whole reply is rejected (`UnusableReply`) if it is not JSON in the agreed shape, if any title or sentence contains
  a digit or any other numeric character outside a placeholder, if it writes a direction word itself outside a
  placeholder ("too low", "add", "take off", "over", "underestimate" and close variants: the direction reaches the page
  only through a fact such as {tv_bias_direction}, so it always matches the figures), if a placeholder names a fact that
  does not exist, if a brace is left over, or if a title or sentence is over its length limit or a block has too many
  sentences.
- A well-formed reply that leaves out a block's title or sentences is accepted: that block keeps its template wording.
- A block id that is not one of the blocks offered (the code-only verdict and rule of thumb are never offered) is ignored,
  so it can never put words on the page.

Nothing here fills a placeholder or decides what is shown: `cricket_blocks.fill` does that, so the number rule is checked
once for the template wording and the model's wording alike.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Mapping

from .cricket_blocks import BLOCK_IDS, CODE_ONLY, MAX_SENTENCE, MAX_TITLE, PLACEHOLDER, max_sentences
from .cricket_facts import Fact
from .llm_reply import UnusableReply, _candidates

# Words that say which way a figure leans or what to do with it. The model may not write them: it names a fact
# ({tv_bias_direction}, {rule_verb}) and code fills in the word that matches the figures.
DIRECTION_WORDS = re.compile(
    r"\b(?:too[\s-]+(?:low|high)|under|over|add(?:s|ed|ing)?|(?:take|takes|took|taking)[\s-]+off|"
    r"(?:under|over)(?:estimat|shoot|predict|state|stat)\w*|(?:lower|higher)\s+than)\b", re.IGNORECASE)


@dataclass
class Wording:
    """What of the reply may be used: per block an optional title and optional sentences (placeholders still in them)."""
    blocks: dict[str, dict[str, Any]] = field(default_factory=dict)


def _safe(name: str) -> str:
    """A name from the reply, cut down to letters, digits and underscores so it can be shown or logged."""
    return "".join(ch for ch in name if ch.isascii() and (ch.isalnum() or ch == "_"))[:40]


def _check_text(text: str, facts: Mapping[str, Fact], what: str) -> None:
    for fid in PLACEHOLDER.findall(text):
        if fid not in facts:
            raise UnusableReply(f"the {what} names a fact that does not exist ({_safe(fid)})")
    bare = PLACEHOLDER.sub("", text)
    if "{" in bare or "}" in bare:
        raise UnusableReply(f"the {what} has a brace that is not a fact placeholder")
    if any(ch.isnumeric() or ch.isdigit() for ch in bare):
        raise UnusableReply(f"the {what} contains a number written by the model")
    if DIRECTION_WORDS.search(bare):
        raise UnusableReply(f"the {what} writes a direction word itself instead of naming a fact")


def _load(text: str) -> dict:
    for candidate in _candidates(text or ""):
        try:
            value = json.loads(candidate)
        except ValueError:
            continue
        if isinstance(value, dict):
            return value
    raise UnusableReply("the reply was not valid JSON")


def parse_writing_reply(text: str, facts: Mapping[str, Fact], available: list[str]) -> Wording:
    """The usable wording in a reply, or UnusableReply. `available` are the ids of the blocks on the page."""
    data = _load(text)
    raw_blocks = data.get("blocks")
    if not isinstance(raw_blocks, dict):
        raise UnusableReply("the reply had no blocks object")
    wording = Wording()
    for bid, entry in raw_blocks.items():
        if bid not in BLOCK_IDS or bid in CODE_ONLY or bid not in available or not isinstance(entry, dict):
            continue                                              # not offered to the model: it cannot reach the page
        out: dict[str, Any] = {}
        title = entry.get("title")
        if isinstance(title, str) and title.strip():
            _check_text(title, facts, f"title of {bid}")
            if len(title) > MAX_TITLE:
                raise UnusableReply(f"the title of {bid} is over {MAX_TITLE} characters")
            out["title"] = title.strip()
        sentences = entry.get("sentences")
        if isinstance(sentences, list):
            good = [s.strip() for s in sentences if isinstance(s, str) and s.strip()]
            if len(good) > max_sentences(bid):
                raise UnusableReply(f"{bid} has more than {max_sentences(bid)} sentence{'s' if max_sentences(bid) != 1 else ''}")
            for s in good:
                _check_text(s, facts, f"sentence in {bid}")
                if len(s) > MAX_SENTENCE:
                    raise UnusableReply(f"a sentence in {bid} is over {MAX_SENTENCE} characters")
            if good:
                out["sentences"] = good
        if out:
            wording.blocks[bid] = out
    return wording

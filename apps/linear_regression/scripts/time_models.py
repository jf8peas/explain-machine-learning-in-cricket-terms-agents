"""Owner tool: time and compare the models a visitor could choose, on a typical proposal prompt (needs OPENROUTER_API_KEY).

    uv run python scripts/time_models.py [rounds] [--fallback | --models ID,ID,...] [--env-file PATH]

For each model it sends `rounds` (default 3) requests shaped like the agent's real ones, with a growing history, and
prints a comparison table: the average and slowest call, how many replies were usable proposals, a projection for a
six-round run, today's OpenRouter prices, an estimated cost for a six-round run, and whether the model fits the
one-minute target (SC-004). Failures are listed under the table.

Prices come from OpenRouter's public model list (no key needed). The cost is an upper-bound estimate: the prompt
size is counted at about four characters a token, and every reply is assumed to use the full `max_tokens` cap, so a
real run usually costs less. Models that "think" before answering are billed for that thinking as output tokens.

  --fallback        test the checked-in list in model_options.py instead of MODEL_OPTIONS (to find candidates)
  --models IDS      test these OpenRouter model ids (comma separated) instead of any list
  --env-file PATH   read KEY=VALUE lines from PATH (for example ../../.env) before starting; values already in the
                    environment win. The file is read literally, so JSON in MODEL_OPTIONS needs no shell quoting.

The key is read from the environment only and is never printed. This script calls the real service (it costs a few
cents); no automated test runs it.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from linreg.llm_client import LlmError, OpenRouterClient  # noqa: E402
from linreg.llm_reply import UnusableReply, parse_reply  # noqa: E402
from linreg.model_options import ModelOption, ModelOptions  # noqa: E402
from linreg.prompts import build_request  # noqa: E402
from linreg.state import ROUND_CAP  # noqa: E402

PRICES_URL = "https://openrouter.ai/api/v1/models"
MAX_TOKENS = 800
TARGET_SECONDS = 60   # SC-004: a six-round run finishes in about a minute

EXPLORE = {
    "train_n": 4036,
    "corr_with_total": {"runs_at_10": 0.81, "wickets_at_10": -0.23, "fours_at_10": 0.40, "sixes_at_10": 0.49},
    "by_wickets": {"0-1 down": {"innings": 1500, "avg_runs_at_10": 81.2, "avg_added_after_10": 98.4},
                   "4 or more down": {"innings": 900, "avg_runs_at_10": 62.0, "avg_added_after_10": 70.1}},
    "mean_total_by_competition": {"ipl": 171.2, "bbl": 160.0, "t20i": 148.7},
}


def load_env_file(path: str) -> None:
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            os.environ.setdefault(name.strip(), value.strip())


def fetch_prices() -> dict[str, tuple[float, float]]:
    """Model id -> (dollars per million input tokens, dollars per million output tokens), from OpenRouter today."""
    try:
        data = httpx.get(PRICES_URL, timeout=20.0).json()["data"]
        return {m["id"]: (float(m["pricing"]["prompt"]) * 1e6, float(m["pricing"]["completion"]) * 1e6) for m in data}
    except (httpx.HTTPError, KeyError, ValueError):
        return {}


def time_model(client: OpenRouterClient, option: ModelOption, rounds: int) -> dict:
    times: list[float] = []
    failures: list[str] = []
    usable = 0
    attempts: list[dict] = []
    input_tokens = 0
    for r in range(1, rounds + 1):
        request = build_request(model=option.id, rounds_remaining=ROUND_CAP - r + 1, explore=EXPLORE,
                                attempts=attempts, rejections=[], max_tokens=MAX_TOKENS, timeout=40.0)
        input_tokens += (len(request.system) + len(request.user)) // 4
        start = time.monotonic()
        try:
            text = client.complete(request)
            try:
                proposal = parse_reply(text)
                usable += 1
                attempts.append({"features": proposal.features, "validation_mae": 17.0 - r, "improved": True, "round": r})
            except UnusableReply as exc:
                failures.append(f"round {r}: unusable reply ({exc})")
        except LlmError as exc:
            failures.append(f"round {r}: {exc}")
        times.append(time.monotonic() - start)
    average = sum(times) / len(times)
    return {"option": option, "average": average, "slowest": max(times), "usable": usable, "rounds": rounds,
            "six": average * ROUND_CAP, "failures": failures,
            # the prompt grows with the history, so scale what was measured over `rounds` up to six rounds
            "input_tokens_six": input_tokens / rounds * ROUND_CAP}


def verdict(row: dict) -> str:
    if row["usable"] == 0:
        return "no"
    if row["usable"] < row["rounds"]:
        return "unreliable"
    return "yes" if row["six"] <= TARGET_SECONDS else "too slow"


def max_run_cost(row: dict, price: tuple[float, float]) -> float:
    """Upper bound for a six-round run: the estimated prompts in, and every reply at the full token cap out."""
    return (row["input_tokens_six"] * price[0] + ROUND_CAP * MAX_TOKENS * price[1]) / 1e6


def table(results: list[dict], prices: dict[str, tuple[float, float]]) -> str:
    results = sorted(results, key=lambda r: (-r["usable"] / r["rounds"], r["average"]))
    header = ["Name", "Model id", "Avg call", "Slowest", "Usable", "Six rounds", "Fits a minute",
              "$/M in", "$/M out", "Max cost/run"]
    rows = []
    for r in results:
        price = prices.get(r["option"].id)
        rows.append([r["option"].name, r["option"].id, f"{r['average']:.1f}s", f"{r['slowest']:.1f}s",
                     f"{r['usable']}/{r['rounds']}", f"~{r['six']:.0f}s", verdict(r),
                     *((f"{price[0]:.2f}", f"{price[1]:.2f}", f"${max_run_cost(r, price):.4f}") if price
                       else ("?", "?", "?"))])
    widths = [max(len(str(x)) for x in col) for col in zip(header, *rows)]
    line = lambda cells: "  ".join(str(c).ljust(w) for c, w in zip(cells, widths)).rstrip()  # noqa: E731
    return "\n".join([line(header), line(["-" * w for w in widths]), *map(line, rows)])


def main(argv: list[str]) -> None:
    rounds, use_fallback, chosen, args = 3, False, None, list(argv)
    if "--env-file" in args:
        i = args.index("--env-file")
        load_env_file(args[i + 1])
        del args[i:i + 2]
    if "--models" in args:
        i = args.index("--models")
        chosen = [m.strip() for m in args[i + 1].split(",") if m.strip()]
        del args[i:i + 2]
    if "--fallback" in args:
        use_fallback = True
        args.remove("--fallback")
    if args:
        rounds = int(args[0])

    if chosen:
        listed = [ModelOption(id=m, name=m.split("/")[-1], note="") for m in chosen]
    else:
        listed = (ModelOptions.from_env({"MODEL_OPTIONS": ""}) if use_fallback else ModelOptions.from_env()).options
    client = OpenRouterClient()
    prices = fetch_prices()
    results = []
    for option in listed:
        print(f"timing {option.name} ({option.id}) ...", flush=True)
        results.append(time_model(client, option, rounds))
    print("\n" + table(results, prices))
    problems = [(r["option"], f) for r in results for f in r["failures"]]
    if problems:
        print("\nProblems:")
        for option, failure in problems:
            print(f"  {option.name}: {failure}")
    print("\nMax cost/run is an upper bound: prompts counted at ~4 characters a token, every reply at the "
          f"{MAX_TOKENS}-token cap. Prices are OpenRouter's, read just now.")
    print(f"A run is six rounds at most; 'fits a minute' means all {rounds} replies were usable and "
          f"six rounds average {TARGET_SECONDS}s or less. Slow or unreliable models should come out of MODEL_OPTIONS.")


if __name__ == "__main__":
    main(sys.argv[1:])

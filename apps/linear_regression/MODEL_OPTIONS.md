# MODEL_OPTIONS: which language models a visitor can choose

`MODEL_OPTIONS` is an environment variable holding the list of models offered in the picker on the page. The owner
sets it (in Vercel, or in `.env` for local runs). Visitors never see model ids or the key, only a name, a note and
an opaque choice. If the variable is unset, the app uses the checked-in list in
`backend/linreg/model_options.py` (`FALLBACK_OPTIONS`), which is the same list as below.

Measured and priced on **2026-10-06**. Prices change; re-run the tool (see the end) before relying on them.

## Format

A JSON list on one line. Exactly one entry has `"default": true`.

| Field | Meaning |
|---|---|
| `id` | the OpenRouter model id |
| `name` | the short label in the picker |
| `note` | one line telling the visitor what to expect |
| `default` | `true` on exactly one entry |

An invalid value stops the server with a clear message rather than being silently ignored.

## The current list

| Name | Model id | Maker | Avg call | Slowest | Usable | Six rounds | $/M in | $/M out | Max cost per run |
|---|---|---|---|---|---|---|---|---|---|
| **Balanced** (default) | `anthropic/claude-haiku-4.5` | Anthropic (US) | 3.0s | 4.4s | 6/6 | ~18s | 1.00 | 5.00 | $0.031 |
| Fast, Chinese maker | `minimax/minimax-m3` | MiniMax (China) | 3.9s | 8.0s | 6/6 | ~23s | 0.30 | 1.20 | $0.008 |
| More thorough | `anthropic/claude-sonnet-5.5` | Anthropic (US) | 4.0s | 5.1s | 6/6 | ~24s | 2.00 | 10.00 | $0.061 |
| Frontier, Chinese maker | `moonshotai/kimi-k3` | Moonshot AI (China) | 4.1s | 5.4s | 6/6 | ~25s | 1.29 | 14.00 | $0.076 |
| Fast | `openai/gpt-6-luna` | OpenAI (US) | 6.6s | 9.9s | 6/6 | ~40s | 0.10 | 0.50 | $0.003 |

How to read it:

- **Avg call / Slowest**: seconds per model call, measured with prompts shaped like the agent's real ones, six rounds
  each.
- **Usable**: replies that parsed as a proposal (features, reason, finished). A model that cannot do this reliably
  makes the run fall back to the rival's grid search only, so it is not offered.
- **Six rounds**: the average call times six, the most a run can use. The target is a run of about a minute (SC-004);
  the hard limit is 90 seconds, which includes a reserve.
- **$/M in, $/M out**: dollars per million input and output tokens, from OpenRouter's public model list that day.
- **Max cost per run** is an upper bound, not a typical cost. The prompt is counted at about four characters a token,
  and every reply is assumed to use the full 800-token cap. Real runs usually cost less. Most runs are under a cent
  to a few cents, and the site's daily cap (300 runs) bounds the worst day: 300 x $0.076 = about $23 if every run
  used the dearest model at its cap.

### Why each model is here

- **Balanced, Claude Haiku 4.5** is the default: the quickest here and reliable on every call in every test.
- **Fast, Chinese maker, MiniMax M3** is the cheapest model that answered every call. It replaces the earlier
  "different maker" slot (Google Gemini 3.8 Flash), which returned an unusable reply on all three calls.
- **More thorough, Claude Sonnet 5.5** is the careful, higher-priced choice from the same maker as the default.
- **Frontier, Chinese maker, Kimi K3** is a frontier-class model from a Chinese maker, and was as quick as the others
  once reasoning effort was set (below). It has the highest price per output token, so it is the dearest to run.
- **Fast, GPT-6 Luna** is the cheapest per token but the slowest here. An earlier test saw one empty reply from it
  in three calls; the six-round test had none. Keep an eye on it.

## What was tried and left out

Tested with three calls each (usable replies out of 3, after reasoning effort was set to low):

| Model | Result |
|---|---|
| `z-ai/glm-5.3-prime` | 3/3, about 3s a call, $0.06 max per run. A good alternative to Kimi K3 (cheaper per run); left out only to keep the list short |
| `z-ai/glm-5.3-flash` | 3/3 but about 14s a call: six rounds ~84s, too slow |
| `google/gemini-3.8-flash` | 0/3: replies did not contain a usable proposal |
| `qwen/qwen3.8-flash`, `qwen/qwen3.8-max-0902`, `qwen/qwen3.7-flash`, `qwen/qwen3.7-plus` | 0 or 1 of 3: empty or unusable replies |
| `deepseek/deepseek-v4.1-flash`, `deepseek/deepseek-v4-flash`, `deepseek/deepseek-v4-pro`, `deepseek/deepseek-v4-pro-0813` | 0 or 1 of 3, and slow (14 to 43s a call) |
| `moonshotai/kimi-k2.6`, `z-ai/glm-5.1`, `minimax/minimax-m2.7` | 0/3, and slow |

"Empty reply" means the host returned no text at all. Three calls is a small sample: a model that failed here might
work with a different prompt, and one that passed can still fail occasionally. The app handles a failed call by
completing the run with the rival's grid search only and saying so.

## A finding that changed the code: reasoning effort

Many of these models "think" before answering, and that thinking counts against the reply cap (`max_tokens`, 800 in
this app) and is billed as output. Without a setting, most of the Chinese models used the whole cap on thinking and
returned nothing. Kimi K3 went from 1 usable reply in 3 (about 15s a call) to 3 in 3 (about 3s), and GLM 5.3 Prime
from 1 in 3 to 3 in 3, once the request asked for low reasoning effort. `backend/linreg/llm_client.py` now sends
`"reasoning": {"effort": "low"}` on every call (`REASONING_EFFORT`); hosts that do not support the setting ignore it.
`tests/test_llm_client.py` checks it is sent.

## The value in use

```
MODEL_OPTIONS=[{"id":"openai/gpt-6-luna","name":"Fast","note":"Quick and cheap; a good first try."},{"id":"minimax/minimax-m3","name":"Fast, Chinese maker","note":"A quick, cheap model from MiniMax (China), to compare styles."},{"id":"anthropic/claude-haiku-4.5","name":"Balanced","default":true,"note":"Quickest here and reliable, with careful reasons."},{"id":"anthropic/claude-sonnet-5.5","name":"More thorough","note":"Slower and more careful; costs more."},{"id":"moonshotai/kimi-k3","name":"Frontier, Chinese maker","note":"Moonshot AI's (China) top model; quick, but the priciest here."}]
```

In Vercel, paste the JSON (the part after `MODEL_OPTIONS=`) as the value, on one line, with no surrounding quotes.

## Re-running the comparison

It calls the real service and costs a few cents. From `apps/linear_regression`:

```
uv run python scripts/time_models.py 6 --env-file ../../.env                 # the models in MODEL_OPTIONS
uv run python scripts/time_models.py --fallback --env-file ../../.env        # the checked-in list
uv run python scripts/time_models.py --models vendor/a,vendor/b --env-file ../../.env   # any OpenRouter ids
```

The argument `6` is the number of calls per model (default 3). The table has the same columns as above, taken
from OpenRouter's live prices. Candidate ids come from https://openrouter.ai/models. A model fits when all replies
are usable and six rounds are estimated at 60 seconds or less. The key is read from the environment only and is
never printed.

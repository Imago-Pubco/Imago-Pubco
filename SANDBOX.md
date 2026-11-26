# Imago Sandbox — set-up guide

The **Sandbox** (user menu › Sandbox) lets a person describe a change in plain words. The AI (Claude or OpenAI) makes it in a private
copy of Imago, on demo data; the person sees it in a preview, refines it, then clicks **Soumettre**. That opens a
GitHub pull request, which an approver reviews and merges. **Nothing reaches the real app without that review.**

## How it is built

| Part | Where | Role |
| --- | --- | --- |
| Sandbox screens | `src/modules/sandbox/` | Requests list, new request, conversation, live preview, submit, review |
| Sandbox API | `server/sandbox.ts` | Rights, budgets, audit; relays to the runner; serves the preview |
| Runner | `sandbox-runner/` (own container) | Git copy per request, AI agent (Claude via the Claude Agent SDK, or OpenAI via `openaiAgent.ts`), preview build, checks, pull request |
| Agent scope | `sandbox-runner/scope.ts` | Decides every tool call: file tools only, writes only in the allowed folders |

## Security, in short

- **Rights:** `sandbox.use` to make requests, only on modules the person can open (no accounting right → no
  accounting request); `sandbox.review` to see all requests and approve. Give them in Administration › Groupes d'accès.
- **The agent** has no shell, no web access and no sub-agents. It reads only inside the copy, never `.env`, keys,
  `.git` or `node_modules`, and writes only in the module's folders (`src/modules/<module>`). Every tool call is
  checked (`scope.ts`, tested by `scope.test.ts`), and the submitted change is checked again before the pull request.
- **Secrets:** with Claude, the agent process gets the Anthropic key only — never the GitHub token, the runner secret or
  any Imago setting. With OpenAI the agent is a plain loop inside the runner that can only call the five file tools
  below (read, list, search, edit, write): it cannot run code, so it cannot read the runner's environment; the same scope
  rules apply, and symbolic links out of the copy are never followed (`openaiAgent.test.ts`). The runner is reachable only from the app, on Docker's internal network, with a shared secret.
- **Preview:** demo data only (the browser demo backend). It is served as an isolated document (CSP sandbox, no
  network): its code can never use the viewer's Imago session, even when an approver opens it.
- **Review:** every change is a pull request; the checks (scope, typecheck, build) have already passed. You decide.
- **Spending:** a monthly cap per person (`SANDBOX_USER_MONTHLY_USD`) and an open-request limit. Also set a monthly
  limit in the Anthropic Console as a hard ceiling.
- **Audit:** creating, prompting, submitting, approving and closing are written to the audit log.

## Turning it on

1. **The AI key.** Either one works; set the one you use:
   - **OpenAI:** put your OpenAI platform key in `.env` as `OPENAI_API_KEY` and set `SANDBOX_PROVIDER=openai`. The default model is
     `gpt-4.1` (change it with `SANDBOX_MODEL`; for reasoning models such as gpt-5 also set `SANDBOX_OPENAI_REASONING=1`).
     The monthly dollar budget is estimated from `SANDBOX_OPENAI_PRICE_IN` / `_OUT` (USD per million tokens, default
     2 and 8): update them if you pick another model. Also set a monthly limit in the OpenAI dashboard as a hard ceiling.
   - **Claude:** in the Anthropic Console, create an API key and a monthly spending limit; put it in `.env` as
     `ANTHROPIC_API_KEY` (it may already be there for PDF reading).
   With both keys present, `SANDBOX_PROVIDER` decides (default: Claude).
2. **GitHub:** create a *fine-grained* token limited to the Imago repository, with **Contents: read and write** and
   **Pull requests: read and write**. Put it in `.env` as `SANDBOX_GITHUB_TOKEN`, and the repository as
   `SANDBOX_GITHUB_REPO` (owner/name).
3. **Secret:** `SANDBOX_RUNNER_SECRET=` a long random value (`openssl rand -hex 32`).
4. **Start it** (the first start clones the repository and installs dependencies, a few minutes):

   ```bash
   cd /opt/imago-pubco && sudo git pull && sudo docker compose --profile sandbox up -d --build
   ```

5. **Rights:** give `sandbox.use` to a pilot group and `sandbox.review` to the approvers.
6. **Try it at no cost first:** set `SANDBOX_TEST_MODE=1`, restart, make a request: the whole path runs (copy, preview,
   checks, pull request) with a fixed small edit instead of Claude. Close the test pull request, then set it back to `0`.

## Every day

- Requests to review: user menu › Sandbox › **À réviser**, or the pull requests labelled `Sandbox :` on GitHub.
- Approving: merge the pull request on GitHub, deploy as usual, then mark it **Approuver** in the Sandbox.
- Refusing: **Refuser** with a reason (the person sees it), and close the pull request.

## Limits

- One module per request, and only `src/modules/<module>` can change: server rules, sign-in, shared components and
  integrations stay out of reach (such requests should come to you as a description).
- The preview runs on demo data in the browser, so features that need the server (Business Central, Microsoft 365,
  e-mail) only show their demo behaviour.
- Each running request uses about 1 CPU and 1–2 GB of memory while building; the runner container is capped at 2 CPU
  and 4 GB.

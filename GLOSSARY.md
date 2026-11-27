# tuiaux

A terminal view of CI pipelines for the repos a developer works on.

## CI

**Provider**:
A CI service that is also the code host (GitHub Actions on github.com, GitLab CI on gitlab.com).
_Avoid_: platform, forge, backend

**Run**:
One execution of a pipeline for a commit: a GitHub workflow run or a GitLab pipeline.
_Avoid_: pipeline, build, workflow run

**Workflow**:
The named definition a run comes from (GitHub workflow name, GitLab pipeline name or source).
_Avoid_: pipeline definition

**Job**:
A unit of work inside a run, possibly grouped by **Stage**.
_Avoid_: task, build step

**Stage**:
A named group of jobs in a run (GitLab only).

**Step**:
An ordered part of a job.
_Avoid_: command, task

**Status**:
The lifecycle state of a run, job or step: success, failure, running, queued, cancelled, skipped, idle.

**Tone**:
One of the four visual families a status maps to: success, running, failure, idle.
_Avoid_: color, severity

**Active**:
A run that is running or queued.

**Settled**:
The moment an active run reaches a final status.
_Avoid_: finished, completed, done

## Repos

**Current repo**:
The repo of the directory tuiaux was started in, always shown first.

**Remembered repo**:
A repo tuiaux has seen with at least one run, shown again from anywhere until forgotten.
_Avoid_: history entry, recent repo, saved repo

**Forget**:
Removing a remembered repo, only by explicit user action.

**Hot repo**:
A repo kept fresh by polling: the current repo, the one under the cursor, or one with an active run.

**Cold repo**:
A repo shown from its last known data and not polled.

**Stale**:
Data shown for a cold repo, labelled with its age.

## Health

**Repo health**:
Whether the last fetch for a repo succeeded or is failing, and when it retries.

**Host issue**:
A problem affecting every repo of a provider at once (missing or invalid credentials, rate limit).

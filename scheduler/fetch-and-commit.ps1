#!/usr/bin/env pwsh
# claude-pulse — fetch and commit (self-healing, Windows)
# PowerShell port of fetch-and-commit.sh — keep the two in sync.
#
# Flow: recover → guard → sync → fetch → commit → push
# Multiple machines may run this against the same repo: data/ conflicts
# are auto-resolved (history union, snapshot newest-wins), a rebase left
# by a crashed run is aborted on the next run, and pushes are retried.
# Works on Windows PowerShell 5.1 and PowerShell 7+.

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $RepoRoot

$LogFile  = Join-Path $PSScriptRoot "fetch.log"
$Merger   = Join-Path $PSScriptRoot "merge-data.cjs"
$MaxLines = 500

function Write-Log($msg) {
    $line = "[$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))] $msg"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

# Rotate log
if ((Test-Path $LogFile) -and ((Get-Content $LogFile).Count -gt $MaxLines)) {
    Get-Content $LogFile | Select-Object -Last ($MaxLines / 2) | Set-Content $LogFile
}

Write-Log "=== claude-pulse fetch ==="

function Test-InRebase {
    (Test-Path (git rev-parse --git-path rebase-merge)) -or
    (Test-Path (git rev-parse --git-path rebase-apply))
}

# `git rebase --continue` refuses an empty commit; skip it instead.
function Invoke-ContinueOrSkip {
    git -c core.editor=true rebase --continue 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { return $true }
    git rebase --skip 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

# During a rebase, :2: (ours) is the remote side and :3: (theirs) is the
# local commit being replayed. Both are machine-generated snapshots, so
# merge-data.cjs can combine them; if it can't, keep the local side.
function Resolve-DataConflicts {
    $rounds = 0
    while (Test-InRebase) {
        $rounds++
        if ($rounds -gt 10) {
            Write-Log "resolver exceeded 10 rounds — aborting rebase"
            git rebase --abort 2>&1 | Out-Null
            return $false
        }
        $conflicted = @(git diff --name-only --diff-filter=U)
        if (-not $conflicted) {
            if (-not (Invoke-ContinueOrSkip)) { git rebase --abort 2>&1 | Out-Null; return $false }
            continue
        }
        foreach ($f in $conflicted) {
            if ($f -eq 'data/history.json' -or $f -eq 'data/usage.json') {
                $oursTmp = "$f.ours.tmp"; $theirsTmp = "$f.theirs.tmp"
                $oursContent   = git show ":2:$f" 2>$null | Out-String
                $oursOk = ($LASTEXITCODE -eq 0)
                $theirsContent = git show ":3:$f" 2>$null | Out-String
                $theirsOk = ($LASTEXITCODE -eq 0)
                $merged = $false
                if ($oursOk -and $theirsOk) {
                    # WriteAllText writes UTF-8 without BOM on both PS 5.1 and 7
                    [IO.File]::WriteAllText((Join-Path $RepoRoot $oursTmp), $oursContent)
                    [IO.File]::WriteAllText((Join-Path $RepoRoot $theirsTmp), $theirsContent)
                    node $Merger $f $oursTmp $theirsTmp 2>$null
                    $merged = ($LASTEXITCODE -eq 0)
                }
                if ($merged) {
                    Write-Log "auto-resolved $f (merged both sides)"
                } else {
                    git checkout --theirs -- $f 2>&1 | Out-Null
                    if ($LASTEXITCODE -ne 0) { git checkout --ours -- $f 2>&1 | Out-Null }
                    Write-Log "auto-resolved $f (kept one side — merge helper unavailable)"
                }
                Remove-Item -ErrorAction SilentlyContinue $oursTmp, $theirsTmp
                git add $f
            } else {
                Write-Log "conflict in non-data file '$f' — aborting rebase; resolve manually"
                git rebase --abort 2>&1 | Out-Null
                return $false
            }
        }
        if (-not (Invoke-ContinueOrSkip)) { git rebase --abort 2>&1 | Out-Null; return $false }
    }
    return $true
}

function Sync-WithRemote {
    git pull --rebase --autostash 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { return $true }
    if (Test-InRebase) { return (Resolve-DataConflicts) }
    return $false  # offline, auth failure, etc.
}

# ── 0. Recover from a previous wedged run ──────────────────────────────────
if (Test-InRebase) {
    git rebase --abort 2>&1 | Out-Null
    Write-Log "recovered: aborted stale rebase left by a previous run"
}
if (Test-Path (git rev-parse --git-path MERGE_HEAD)) {
    git merge --abort 2>&1 | Out-Null
    Write-Log "recovered: aborted stale merge left by a previous run"
}

# ── 1. Branch guard — only commit/push from main ───────────────────────────
$currentBranch = git symbolic-ref --short HEAD 2>&1
if ($LASTEXITCODE -ne 0) { $currentBranch = 'detached' }
if ($currentBranch -ne 'main') {
    Write-Log "SKIP: not on main branch (currently '$currentBranch') — aborting"
    exit 0
}

# ── 2. Sync BEFORE fetching new data — minimizes the conflict window ───────
if (Sync-WithRemote) {
    Write-Log "synced with remote"
} else {
    Write-Log "WARN: sync failed (offline or unresolvable conflict) — continuing with local state"
}

# Guard: a corrupt history.json would crash the fetch CLI on every run.
if (Test-Path data/history.json) {
    node -e "JSON.parse(require('fs').readFileSync('data/history.json','utf8'))" 2>$null
    if ($LASTEXITCODE -ne 0) {
        git checkout HEAD -- data/history.json 2>&1 | Out-Null
        Write-Log "recovered: restored corrupt data/history.json from HEAD"
    }
}

# ── 3. Fetch & write data/ ─────────────────────────────────────────────────
$CoreCli = Join-Path $RepoRoot "core\dist\cli.js"
if (Test-Path $CoreCli) {
    node $CoreCli fetch
    if ($LASTEXITCODE -ne 0) { Write-Log "fetch: FAILED (exit $LASTEXITCODE) — committing error snapshot" }
    else { Write-Log "fetch: OK" }
} elseif (Get-Command claude-pulse -ErrorAction SilentlyContinue) {
    claude-pulse fetch
    if ($LASTEXITCODE -ne 0) { Write-Log "fetch (global cli): FAILED (exit $LASTEXITCODE) — committing error snapshot" }
    else { Write-Log "fetch (global cli): OK" }
} else {
    Write-Log "ERROR: cannot find core\dist\cli.js or claude-pulse in PATH"
    exit 1
}

# ── 4. Stage explicit allowlist only — mirrors vite copyDataPlugin whitelist
git add "data/usage.json" "data/history.json"
if ($LASTEXITCODE -ne 0) { Write-Log "git add FAILED (exit $LASTEXITCODE)"; exit 1 }

# ── 5. Commit if changed ───────────────────────────────────────────────────
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Log "data/ unchanged — nothing to commit"
} else {
    $ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    git commit -m "chore: update usage snapshot $ts" --no-verify | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Log "git commit FAILED (exit $LASTEXITCODE)"; exit 1 }
    Write-Log "committed: $(git rev-parse --short HEAD)"
}

# ── 6. Push, re-syncing and retrying if another machine pushed first ───────
$pushed = $false
foreach ($attempt in 1..3) {
    git push 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
    Write-Log "push rejected (attempt $attempt) — re-syncing"
    if (-not (Sync-WithRemote)) { break }
}

if ($pushed) {
    Write-Log "pushed OK"
} else {
    Write-Log "push FAILED — local commit is safe; next run will re-sync and retry"
}

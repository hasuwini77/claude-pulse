# claude-pulse — Windows Scheduled Task installer
# Run once as Administrator (or with Task Scheduler rights):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\scheduler\install-windows.ps1
#
# Registers a task that runs fetch-and-commit.ps1 every 15 minutes.
# ONLY data\ is ever staged — secrets and the whole tree are never touched.

#Requires -Version 5.1

$TaskName   = "claude-pulse-fetch"
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$ScriptPath = Join-Path $PSScriptRoot "fetch-and-commit.ps1"

# Build the PowerShell fetch-and-commit script if it doesn't exist yet
if (-not (Test-Path $ScriptPath)) {
    @'
#!/usr/bin/env pwsh
# claude-pulse — fetch and commit (Windows)
# Run from Scheduled Task; REPO_ROOT is the parent of this script's dir.

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $RepoRoot

$LogFile   = Join-Path $PSScriptRoot "fetch.log"
$MaxLines  = 500

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')] $msg"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

# Rotate log
if ((Test-Path $LogFile) -and ((Get-Content $LogFile).Count -gt $MaxLines)) {
    Get-Content $LogFile | Select-Object -Last ($MaxLines / 2) | Set-Content $LogFile
}

Write-Log "=== claude-pulse fetch ==="

# 0. Branch guard — only commit/push on main
$currentBranch = git symbolic-ref --short HEAD 2>&1
if ($LASTEXITCODE -ne 0) { $currentBranch = 'detached' }
if ($currentBranch -ne 'main') {
    Write-Log "SKIP: not on main branch (currently '$currentBranch') — aborting"
    exit 0
}

# 1. Fetch & write data/
$CoreCli = Join-Path $RepoRoot "core\dist\cli.js"
if (Test-Path $CoreCli) {
    node $CoreCli fetch
    # Non-zero exit: core writes an error snapshot to data/ — continue so the dashboard shows the outage
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

# 2. Stage explicit allowlist only — mirrors vite copyDataPlugin whitelist
git add "data\usage.json" "data\history.json"
if ($LASTEXITCODE -ne 0) { Write-Log "git add FAILED (exit $LASTEXITCODE)"; exit 1 }

# 3. Commit if changed
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Log "data\ unchanged — nothing to commit"
} else {
    $ts = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
    git commit -m "chore: update usage snapshot $ts" --no-verify
    if ($LASTEXITCODE -ne 0) { Write-Log "git commit FAILED (exit $LASTEXITCODE)"; exit 1 }
    $sha = git rev-parse --short HEAD
    Write-Log "committed: $sha"
}

# 4. Pull --rebase to avoid divergence, then push
git pull --rebase --autostash
if ($LASTEXITCODE -ne 0) {
    Write-Log "pull --rebase FAILED — aborting push (resolve conflicts manually then run again)"
    exit 1
}
Write-Log "pulled (rebased)"
git push
if ($LASTEXITCODE -ne 0) { Write-Log "push FAILED (check remote auth — exit $LASTEXITCODE)"; exit 1 }
Write-Log "pushed OK"
'@ | Set-Content -Path $ScriptPath -Encoding UTF8
    Write-Host "Created $ScriptPath"
}

# --- Register Scheduled Task ---
$Action  = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NonInteractive -NoProfile -File `"$ScriptPath`"" `
    -WorkingDirectory $RepoRoot

# Every 15 minutes, starting now, repeat for 1 day (auto-repeats daily)
$Trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 15) `
           -Once -At (Get-Date) -RepetitionDuration (New-TimeSpan -Days 3650)

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Remove existing task if present
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task: $TaskName"
}

Register-ScheduledTask `
    -TaskName  $TaskName `
    -Action    $Action `
    -Trigger   $Trigger `
    -Settings  $Settings `
    -RunLevel  Limited `
    -Description "claude-pulse: fetch usage snapshot and commit data/ every 15 min" | Out-Null

Write-Host ""
Write-Host "Registered Scheduled Task: $TaskName"
Write-Host "  Script : $ScriptPath"
Write-Host "  Runs   : every 15 minutes"
Write-Host ""
Write-Host "To uninstall: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

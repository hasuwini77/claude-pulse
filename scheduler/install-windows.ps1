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

# fetch-and-commit.ps1 is tracked in the repo (the installer used to
# generate it once at install time, which meant fixes never reached
# existing installs — now it always runs the repo's current version).
if (-not (Test-Path $ScriptPath)) {
    Write-Error "fetch-and-commit.ps1 not found at $ScriptPath — pull the latest version of this repo and re-run."
    exit 1
}

# Prefer PowerShell 7 (pwsh) when available, fall back to Windows PowerShell
$PsExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh.exe" } else { "powershell.exe" }

# --- Register Scheduled Task ---
$Action  = New-ScheduledTaskAction `
    -Execute $PsExe `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
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
Write-Host "  Runs   : $PsExe $ScriptPath"
Write-Host "  Every  : 15 minutes"
Write-Host ""
Write-Host "To uninstall: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

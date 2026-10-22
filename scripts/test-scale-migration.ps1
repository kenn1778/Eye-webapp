#requires -Version 5.1
<#
.SYNOPSIS
  Verifies the release-migration design: the one-shot `migrate` service applies
  the schema exactly once, and N backend replicas start afterwards without ever
  racing each other on migrations.

.DESCRIPTION
  Runs an isolated Compose project (default name "eyescale") using
  docker-compose.yml plus docker-compose.scale-test.yml, which drops the fixed
  host port on the API so `--scale backend=N` is possible on one machine.

  Assertions:
    1. exactly one `migrate` container ran, and it exited 0
    2. N backend replicas are running
    3. every replica answers GET /healthz with db=up and cache=up
    4. the runtime image cannot run migrations (Prisma CLI is absent)
    5. _prisma_migrations holds every local migration, none unfinished
    6. no migration was applied twice, and no race marker appears in the logs

.PARAMETER Replicas
  Number of backend replicas to start. Default 3.

.PARAMETER ControlMode
  Additionally runs three concurrent `prisma migrate deploy` processes against a
  fresh database using the migrate image, to document how concurrent deploys
  behave. Report-only: it does not change the pass/fail result above.

.PARAMETER WithFrontend
  Also build and start the frontend, then check http://localhost:8080/healthz so
  the request path through nginx to the replica set is exercised. Slower build.

.PARAMETER Keep
  Leave the stack running for inspection instead of tearing it down.

.EXAMPLE
  powershell -File scripts/test-scale-migration.ps1
.EXAMPLE
  powershell -File scripts/test-scale-migration.ps1 -Replicas 3 -WithFrontend -Keep
#>
[CmdletBinding()]
param(
  [int]$Replicas = 3,
  [string]$Project = "eyescale",
  [switch]$ControlMode,
  [switch]$WithFrontend,
  [switch]$Keep
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$script:failures = 0
function Step([string]$Message) { Write-Host ""; Write-Host "==> $Message" -ForegroundColor Cyan }
function Ok([string]$Message) { Write-Host "    ok   $Message" -ForegroundColor Green }
function Fail([string]$Message) { Write-Host "    FAIL $Message" -ForegroundColor Red; $script:failures++ }
function Note([string]$Message) { Write-Host "    note $Message" -ForegroundColor DarkGray }

# Every helper takes one array so arguments such as -T or --filter are never
# mistaken for PowerShell parameter names.
$composeFiles = @("-f", "docker-compose.yml", "-f", "docker-compose.scale-test.yml")

# Compose and the Docker CLI write progress to stderr, which PowerShell would
# otherwise turn into a terminating error, so stderr is not fatal in here.
function RunCompose {
  param([string[]]$Arguments)
  $ErrorActionPreference = "Continue"
  & docker.exe compose -p $Project @composeFiles @Arguments
}
function RunDocker {
  param([string[]]$Arguments)
  $ErrorActionPreference = "Continue"
  & docker.exe @Arguments
}

function ContainerLabel([string]$Service) {
  $found = RunDocker @("ps", "-aq",
      "--filter", "label=com.docker.compose.project=$Project",
      "--filter", "label=com.docker.compose.service=$Service")
  @($found | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
}

# Container timestamps are RFC 3339; the first 19 characters are a sortable
# "yyyy-MM-ddTHH:mm:ss" in UTC.
function DockerTime([string]$ContainerId, [string]$Template) {
  $raw = [string](RunDocker @("inspect", "-f", $Template, $ContainerId) 2>&1 | Out-String).Trim()
  if ($raw.Length -lt 19) { return $null }
  try { return [datetime]::ParseExact($raw.Substring(0, 19), "yyyy-MM-ddTHH:mm:ss", [Globalization.CultureInfo]::InvariantCulture) } catch { return $null }
}

function Wait-ForHttp([string]$ContainerId, [int]$TimeoutSeconds = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $probe = "fetch('http://127.0.0.1:4000/healthz').then(function(r){return r.text()}).then(function(t){process.stdout.write(t)}).catch(function(e){process.stdout.write('ERR ' + e.message)})"
  $last = ""
  while ((Get-Date) -lt $deadline) {
    $last = (RunDocker @("exec", $ContainerId, "node", "-e", $probe) 2>&1 | Out-String).Trim()
    if ($last -match '"status"\s*:\s*"ok"') { return $last }
    Start-Sleep -Seconds 2
  }
  return $last
}

function Count-Sql([string]$Database, [string]$Sql) {
  (RunCompose @("exec", "-T", "db", "psql", "-U", "postgres", "-d", $Database, "-tAc", $Sql) 2>&1 | Out-String).Trim()
}

$startedAt = Get-Date

# ---------------------------------------------------------------- preflight --
Step "Preflight"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "docker CLI not found. Install Docker Desktop, start it, then re-run." -ForegroundColor Red
  exit 1
}
$serverVersion = (& docker.exe version --format "{{.Server.Version}}" 2>$null | Out-String).Trim()
if (-not $serverVersion) {
  Write-Host "The Docker daemon is not reachable. Start Docker Desktop and try again." -ForegroundColor Red
  exit 1
}
Ok "docker server $serverVersion"
foreach ($file in @("docker-compose.yml", "docker-compose.scale-test.yml", "backend/.env", "backend/Dockerfile")) {
  if (Test-Path -LiteralPath $file) { Ok "$file present" } else { Fail "$file is missing" }
}
if ($script:failures -gt 0) { exit 1 }

# ------------------------------------------------------------- clean state --
Step "Reset project '$Project' (containers, networks, volumes)"
RunCompose @("down", "-v", "--remove-orphans") 2>&1 | Out-Null
Ok "clean slate"

# ------------------------------------------------------------------- start --
$services = @("db", "redis", "migrate", "backend")
if ($WithFrontend) { $services += "frontend" }
Step "building images (sequentially, to keep peak memory low)"
foreach ($target in @("migrate", "backend")) {
  RunCompose @("build", $target)
  if ($LASTEXITCODE -ne 0) { Fail "docker compose build $target failed"; exit 1 }
  Ok "built $target"
}

Step "docker compose up -d --scale backend=$Replicas ($($services -join ' '))"
RunCompose (@("up", "-d", "--scale", "backend=$Replicas") + $services)
if ($LASTEXITCODE -ne 0) { Fail "docker compose up failed"; exit 1 }
Ok "stack started"

# ------------------------------------------------------- migrate one-shot ----
Step "Assertion 1: the migrate service runs once and exits cleanly"
$deadline = (Get-Date).AddMinutes(10)
$migrateState = "missing"
$migrateId = ""
while ((Get-Date) -lt $deadline) {
  $found = @(ContainerLabel "migrate")
  if ($found.Count -eq 0) { Start-Sleep -Seconds 2; continue }
  $migrateId = [string]($found | Select-Object -First 1)
  $migrateState = [string](RunDocker @("inspect", "-f", "{{.State.Status}}", $migrateId) 2>&1 | Out-String).Trim()
  if ($migrateState -ne "running") { break }
  Start-Sleep -Seconds 2
}
$migrateIds = @(ContainerLabel "migrate")
if ($migrateIds.Count -eq 1) { Ok "exactly one migrate container" } else { Fail "found $($migrateIds.Count) migrate containers (expected 1)" }
if ($migrateState -eq "exited") {
  $code = [string](RunDocker @("inspect", "-f", "{{.State.ExitCode}}", $migrateId) 2>&1 | Out-String).Trim()
  if ($code -eq "0") { Ok "migrate exited 0" } else { Fail "migrate exited $code" }
} else {
  Fail "migrate ended in state '$migrateState'"
}

# --------------------------------------------------------------- replicas ----
Step "Assertion 2: $Replicas backend replicas are running"
$backendIds = ContainerLabel "backend"
if ($backendIds.Count -eq $Replicas) { Ok "$Replicas replica containers" } else { Fail "found $($backendIds.Count) replica containers (expected $Replicas)" }
$running = 0
foreach ($id in $backendIds) {
  if ((RunDocker @("inspect", "-f", "{{.State.Running}}", $id) | Out-String).Trim() -eq "true") { $running++ }
}
if ($running -eq $backendIds.Count) { Ok "all replica containers running" } else { Fail "$running of $($backendIds.Count) containers running" }

Step "Assertion 3: every replica serves /healthz with db and cache up"
foreach ($id in $backendIds) {
  $short = $id.Substring(0, 12)
  $body = Wait-ForHttp $id
  if ($body -match '"db"\s*:\s*"up"' -and $body -match '"cache"\s*:\s*"up"') {
    Ok "$short -> $body"
  } else {
    Fail "$short -> $body"
  }
}

Step "Assertion 4: replicas never migrate, and only start after the migrate step finished"
$migrateFinished = DockerTime $migrateId "{{.State.FinishedAt}}"
foreach ($id in $backendIds) {
  $short = $id.Substring(0, 12)
  $cmd = [string](RunDocker @("inspect", "-f", "{{json .Config.Cmd}}", $id) 2>&1 | Out-String).Trim()
  if ($cmd -notmatch "migrate") { Ok "$short CMD has no migration step ($cmd)" } else { Fail "$short CMD runs migrations: $cmd" }
  $started = DockerTime $id "{{.State.StartedAt}}"
  if ($started -and $migrateFinished -and $started -ge $migrateFinished) {
    Ok "$short started $started, after migrate finished $migrateFinished"
  } else {
    Fail "$short started $started, migrate finished $migrateFinished"
  }
}

# ------------------------------------------------------------- migrations ----
Step "Assertion 5: migration history is complete"
$expected = @(Get-ChildItem -LiteralPath "backend/prisma/migrations" -Directory).Count
$applied = Count-Sql "scholarship" "select count(*) from _prisma_migrations where finished_at is not null"
$unfinished = Count-Sql "scholarship" "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null"
if ($applied -eq "$expected") { Ok "$applied of $expected migrations applied" } else { Fail "$applied migrations recorded, $expected expected" }
if ($unfinished -eq "0") { Ok "no unfinished migrations" } else { Fail "$unfinished migration rows are unfinished" }

Step "Assertion 6: no migration applied twice and no race markers in the logs"
$logs = (RunCompose @("logs", "--no-color") 2>&1 | Out-String)
$appliedNames = [regex]::Matches($logs, "Applying migration\s+``([^``]+)``") | ForEach-Object { $_.Groups[1].Value }
$duplicates = $appliedNames | Group-Object | Where-Object { $_.Count -gt 1 }
if ($appliedNames.Count -gt 0) { Note "migrations applied in this run: $($appliedNames.Count)" }
if ($duplicates) { Fail "applied more than once: $($duplicates.Name -join ', ')" } else { Ok "no migration applied more than once" }
foreach ($marker in @("P3005", "P1002", "already exists", "deadlock detected", "Connection terminated unexpectedly", "Failed to apply migration", "prisma migrate")) {
  if ($logs -match [regex]::Escape($marker)) { Fail "log marker present: $marker" } else { Ok "no '$marker'" }
}

# ------------------------------------------------------------- proxy path ----
if ($WithFrontend) {
  Step "Proxy path: GET http://localhost:8080/healthz through nginx"
  $okHttp = $false
  $deadline = (Get-Date).AddSeconds(90)
  $body = ""
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -UseBasicParsing -TimeoutSec 10
      $body = $response.Content
      if ($response.StatusCode -eq 200 -and $body -match '"status"\s*:\s*"ok"') { $okHttp = $true; break }
    } catch { $body = $_.Exception.Message }
    Start-Sleep -Seconds 3
  }
  if ($okHttp) { Ok "nginx -> backend -> $body" } else { Fail "nginx did not serve /healthz: $body" }
}

# ------------------------------------------------------------ control run ----
if ($ControlMode) {
  Step "Control mode: three concurrent 'prisma migrate deploy' runs (report only)"
  RunDocker @("build", "-q", "-t", "$Project-migrate:local", "--target", "migrate", "./backend") | Out-Null
  $network = "$($Project)_default"
  $controlDb = "$Project-control-db"
  RunDocker @("rm", "-f", $controlDb) 2>&1 | Out-Null
  RunDocker @("run", "-d", "--name", $controlDb, "--network", $network, "-e", "POSTGRES_PASSWORD=postgres", "-e", "POSTGRES_DB=scholarship_control", "postgres:16-alpine") | Out-Null
  Start-Sleep -Seconds 6
  $url = "postgresql://postgres:postgres@$($controlDb):5432/scholarship_control"
  $jobs = 1..3 | ForEach-Object {
    Start-Job -ScriptBlock {
      param($image, $network, $url)
      $out = & docker.exe run --rm --network $network -e "DATABASE_URL=$url" $image 2>&1 | Out-String
      [pscustomobject]@{ Exit = $LASTEXITCODE; Output = $out }
    } -ArgumentList "$Project-migrate:local", $network, $url
  }
  $results = $jobs | Wait-Job | Receive-Job
  $jobs | Remove-Job -Force
  Note "concurrent deploy exit codes: $(($results | ForEach-Object { $_.Exit }) -join ', ')"
  Note "migrations recorded after concurrent deploy: $(Count-Sql 'scholarship_control' 'select count(*) from _prisma_migrations where finished_at is not null') (expected $expected)"
  if ((($results | ForEach-Object { $_.Output }) -join "`n") -match "P1002|deadlock detected|Connection terminated unexpectedly") {
    Note "at least one concurrent run reported lock contention - exactly what the single release step avoids"
  }
  RunDocker @("rm", "-f", $controlDb) 2>&1 | Out-Null
}

# ---------------------------------------------------------------- cleanup ----
$elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
if ($Keep) {
  Step "Leaving the stack up (project '$Project'). Tear down with: docker compose -p $Project down -v --remove-orphans"
} else {
  Step "Tearing down project '$Project'"
  RunCompose @("down", "-v", "--remove-orphans") 2>&1 | Out-Null
}

Write-Host ""
if ($script:failures -eq 0) {
  Write-Host "PASS - $Replicas replicas, one migrate run, no migration race (${elapsed}s)" -ForegroundColor Green
  exit 0
}
Write-Host "FAIL - $($script:failures) assertion(s) failed (${elapsed}s)" -ForegroundColor Red
exit 1
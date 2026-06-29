$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path -LiteralPath $node)) {
  throw "Bundled Node runtime was not found at $node"
}

$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pidValue in $listeners) {
  if ($pidValue) {
    Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Seconds 1

$nextDir = Join-Path $workspace ".next"
if (Test-Path -LiteralPath $nextDir) {
  Remove-Item -LiteralPath $nextDir -Recurse -Force
}

Start-Process `
  -FilePath $node `
  -ArgumentList "node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", "3000" `
  -WorkingDirectory $workspace `
  -WindowStyle Hidden

Start-Sleep -Seconds 8

try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/upload" -UseBasicParsing -TimeoutSec 20
  "Rocketry House dev server restarted. /upload returned HTTP $($response.StatusCode)."
} catch {
  "Dev server started, but /upload did not respond yet: $($_.Exception.Message)"
}

param(
    [switch]$Production,
    [switch]$PullModel = $true
)

$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [string]$FailureMessage = "Docker command failed"
    )

    & docker @Args
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE): docker $($Args -join ' ')"
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not installed. Please install Docker Desktop first."
}

$dockerService = Get-Service com.docker.service -ErrorAction SilentlyContinue
if ($null -eq $dockerService) {
    throw "Docker Desktop service was not found. Please install Docker Desktop."
}

if ($dockerService.Status -ne 'Running') {
    throw "Docker Desktop service is not running. Start Docker Desktop (or run as Administrator once), then retry."
}

try {
    Invoke-Docker -Args @("info") -FailureMessage "Docker daemon is not running"
} catch {
    throw "Docker daemon is not running. Start Docker Desktop and try again."
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

$composeArgs = @("compose")

if ($Production) {
    if (-not (Test-Path ".env.prod")) {
        Copy-Item ".env.prod.example" ".env.prod"
        Write-Host "Created .env.prod from .env.prod.example" -ForegroundColor Yellow
    }

    $composeArgs += @("--env-file", ".env", "--env-file", ".env.prod", "-f", "docker-compose.yml", "-f", "docker-compose.prod.yml")
}

if ($PullModel) {
    Invoke-Docker -Args ($composeArgs + @("--profile", "init", "up", "ollama-init")) -FailureMessage "Failed to pull/init Ollama model"
}

Invoke-Docker -Args ($composeArgs + @("up", "--build", "-d")) -FailureMessage "Failed to start application stack"
Invoke-Docker -Args ($composeArgs + @("ps")) -FailureMessage "Failed to query running services"

Write-Host "" 
Write-Host "Application is starting:" -ForegroundColor Green
Write-Host "- Frontend: http://localhost:3000"
Write-Host "- Backend:  http://localhost:8000/api/health"
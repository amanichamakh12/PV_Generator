param(
    [switch]$Production,
    [switch]$RemoveVolumes
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
    throw "Docker Desktop service is not running. Start Docker Desktop, then retry."
}

try {
    Invoke-Docker -Args @("info") -FailureMessage "Docker daemon is not running"
} catch {
    throw "Docker daemon is not running. Start Docker Desktop and try again."
}

$composeArgs = @("compose")

if ($Production) {
    $composeArgs += @("--env-file", ".env", "--env-file", ".env.prod", "-f", "docker-compose.yml", "-f", "docker-compose.prod.yml")
}

$downArgs = @("down")
if ($RemoveVolumes) {
    $downArgs += "-v"
}

Invoke-Docker -Args ($composeArgs + $downArgs) -FailureMessage "Failed to stop application stack"
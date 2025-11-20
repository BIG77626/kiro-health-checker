# P1-004 Cloud Function Deployment Preparation Script
# Purpose: Copy core and adapters to cloud function directory

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "[Deploy] P1-004 Cloud Function Deployment Preparation" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Define paths
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ll5Root = Split-Path -Parent (Split-Path -Parent $scriptPath)
$cloudFunctionRoot = $scriptPath
$coreSource = Join-Path $ll5Root "core"
$adaptersSource = Join-Path $ll5Root "adapters"
$coreTarget = Join-Path $cloudFunctionRoot "core"
$adaptersTarget = Join-Path $cloudFunctionRoot "adapters"

Write-Host "[Deploy] Paths:" -ForegroundColor Yellow
Write-Host "  LL5.2 Root: $ll5Root"
Write-Host "  Cloud Function: $cloudFunctionRoot"
Write-Host "  Core Source: $coreSource"
Write-Host "  Adapters Source: $adaptersSource"
Write-Host ""

# Check if source directories exist
if (-not (Test-Path $coreSource)) {
    Write-Host "[Error] Core source not found: $coreSource" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $adaptersSource)) {
    Write-Host "[Error] Adapters source not found: $adaptersSource" -ForegroundColor Red
    exit 1
}

Write-Host "[Deploy] Step 1: Cleaning old copies..." -ForegroundColor Green

# Remove old copies
if (Test-Path $coreTarget) {
    Write-Host "  Removing old core directory..."
    Remove-Item -Recurse -Force $coreTarget
}

if (Test-Path $adaptersTarget) {
    Write-Host "  Removing old adapters directory..."
    Remove-Item -Recurse -Force $adaptersTarget
}

Write-Host "[Deploy] Step 2: Copying core directory..." -ForegroundColor Green

# Copy core directory
Copy-Item -Path $coreSource -Destination $coreTarget -Recurse -Force

# Remove test files from core
Write-Host "  Removing test files from core..."
Get-ChildItem -Path $coreTarget -Recurse -Directory -Filter "__tests__" | Remove-Item -Recurse -Force
Get-ChildItem -Path $coreTarget -Recurse -File -Filter "*.test.js" | Remove-Item -Force
Get-ChildItem -Path $coreTarget -Recurse -Directory -Filter "node_modules" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[Deploy] Step 3: Copying adapters directory..." -ForegroundColor Green

# Copy adapters directory
Copy-Item -Path $adaptersSource -Destination $adaptersTarget -Recurse -Force

# Remove test files from adapters
Write-Host "  Removing test files from adapters..."
Get-ChildItem -Path $adaptersTarget -Recurse -Directory -Filter "__tests__" | Remove-Item -Recurse -Force
Get-ChildItem -Path $adaptersTarget -Recurse -File -Filter "*.test.js" | Remove-Item -Force

Write-Host "[Deploy] Step 4: Updating index.js require path..." -ForegroundColor Green

# Modify require paths in index.js
$indexPath = Join-Path $cloudFunctionRoot "index.js"
$indexContent = Get-Content $indexPath -Raw -Encoding UTF8

# Replace paths
$indexContent = $indexContent -replace "require\('\.\.\/\.\.\/core\/", "require('./core/"
$indexContent = $indexContent -replace "require\('\.\.\/\.\.\/adapters\/", "require('./adapters/"

Set-Content -Path $indexPath -Value $indexContent -Encoding UTF8 -NoNewline

Write-Host "[Deploy] Step 5: Verifying deployment readiness..." -ForegroundColor Green

# Verify required files
$requiredFiles = @(
    "index.js",
    "package.json",
    "config.json",
    "core/application/services/ServiceContainer.js",
    "core/application/services/FeedbackAggregationService.js"
)

$allExist = $true
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $cloudFunctionRoot $file
    if (Test-Path $filePath) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
        $allExist = $false
    }
}

Write-Host ""

if (-not $allExist) {
    Write-Host "[Error] Some required files are missing!" -ForegroundColor Red
    exit 1
}

# Calculate directory sizes
$coreSizeMB = [math]::Round((Get-ChildItem -Path $coreTarget -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
$adaptersSizeMB = [math]::Round((Get-ChildItem -Path $adaptersTarget -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
$totalSizeMB = $coreSizeMB + $adaptersSizeMB

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "[Deploy] Preparation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Core size: $coreSizeMB MB"
Write-Host "  Adapters size: $adaptersSizeMB MB"
Write-Host "  Total size: $totalSizeMB MB"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open WeChat Developer Tools"
Write-Host "  2. Right-click 'weekly-feedback-aggregation' folder"
Write-Host "  3. Select 'Upload and Deploy: Install Dependencies in Cloud'"
Write-Host "  4. Wait for deployment to complete"
Write-Host "  5. Test manually in Cloud Console"
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan

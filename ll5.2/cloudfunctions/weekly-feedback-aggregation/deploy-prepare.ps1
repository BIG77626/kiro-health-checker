# P1-004云函数部署准备脚本
# 功能: 复制core和adapters到云函数目录（方案A）
# 用法: .\deploy-prepare.ps1

Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "[Deploy] P1-004 Cloud Function Deployment Preparation" -ForegroundColor Cyan
Write-Host "[Deploy] Applying cloud-function-development v1.0" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# 定义路径
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ll5Root = Split-Path -Parent (Split-Path -Parent $scriptPath)
$cloudFunctionRoot = $scriptPath
$coreSource = Join-Path $ll5Root "core"
$adaptersSource = Join-Path $ll5Root "adapters"
$coreTarget = Join-Path $cloudFunctionRoot "core"
$adaptersTarget = Join-Path $cloudFunctionRoot "adapters"

Write-Host "[Deploy] Paths:" -ForegroundColor Yellow
Write-Host "  - LL5.2 Root: $ll5Root"
Write-Host "  - Cloud Function: $cloudFunctionRoot"
Write-Host "  - Core Source: $coreSource"
Write-Host "  - Adapters Source: $adaptersSource"
Write-Host ""

# 检查源目录是否存在
if (-not (Test-Path $coreSource)) {
    Write-Host "[Error] Core source not found: $coreSource" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $adaptersSource)) {
    Write-Host "[Error] Adapters source not found: $adaptersSource" -ForegroundColor Red
    exit 1
}

Write-Host "[Deploy] Step 1: Cleaning old copies..." -ForegroundColor Green

# 删除旧的复制
if (Test-Path $coreTarget) {
    Write-Host "  - Removing old core directory..."
    Remove-Item -Recurse -Force $coreTarget
}

if (Test-Path $adaptersTarget) {
    Write-Host "  - Removing old adapters directory..."
    Remove-Item -Recurse -Force $adaptersTarget
}

Write-Host "[Deploy] Step 2: Copying core directory..." -ForegroundColor Green

# 复制core目录（排除测试文件和node_modules）
Copy-Item -Path $coreSource -Destination $coreTarget -Recurse -Force

# 删除测试文件
Write-Host "  - Removing test files from core..."
Get-ChildItem -Path $coreTarget -Recurse -Directory -Filter "__tests__" | Remove-Item -Recurse -Force
Get-ChildItem -Path $coreTarget -Recurse -File -Filter "*.test.js" | Remove-Item -Force
Get-ChildItem -Path $coreTarget -Recurse -Directory -Filter "node_modules" | Remove-Item -Recurse -Force

Write-Host "[Deploy] Step 3: Copying adapters directory..." -ForegroundColor Green

# 复制adapters目录
Copy-Item -Path $adaptersSource -Destination $adaptersTarget -Recurse -Force

# 删除测试文件
Write-Host "  - Removing test files from adapters..."
Get-ChildItem -Path $adaptersTarget -Recurse -Directory -Filter "__tests__" | Remove-Item -Recurse -Force
Get-ChildItem -Path $adaptersTarget -Recurse -File -Filter "*.test.js" | Remove-Item -Force

Write-Host "[Deploy] Step 4: Updating index.js require path..." -ForegroundColor Green

# 修改index.js中的require路径
$indexPath = Join-Path $cloudFunctionRoot "index.js"
$indexContent = Get-Content $indexPath -Raw

# 替换路径
$indexContent = $indexContent -replace "require\('\.\.\/\.\.\/core\/", "require('./core/"
$indexContent = $indexContent -replace "require\('\.\.\/\.\.\/adapters\/", "require('./adapters/"

$indexContent | Set-Content $indexPath -NoNewline

Write-Host "[Deploy] Step 5: Verifying deployment readiness..." -ForegroundColor Green

# 验证关键文件
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
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (MISSING)" -ForegroundColor Red
        $allExist = $false
    }
}

Write-Host ""

if (-not $allExist) {
    Write-Host "[Error] Some required files are missing!" -ForegroundColor Red
    exit 1
}

# 计算目录大小
$coreSizeMB = [math]::Round((Get-ChildItem -Path $coreTarget -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
$adaptersSizeMB = [math]::Round((Get-ChildItem -Path $adaptersTarget -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
$totalSizeMB = $coreSizeMB + $adaptersSizeMB

Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "[Deploy] Preparation Complete! ✅" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - Core size: $coreSizeMB MB"
Write-Host "  - Adapters size: $adaptersSizeMB MB"
Write-Host "  - Total size: $totalSizeMB MB"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open WeChat Developer Tools"
Write-Host "  2. Right-click 'weekly-feedback-aggregation' folder"
Write-Host "  3. Select '上传并部署：云端安装依赖'"
Write-Host "  4. Wait for deployment to complete"
Write-Host "  5. Test manually in Cloud Console"
Write-Host ""
Write-Host ("=" * 80) -ForegroundColor Cyan

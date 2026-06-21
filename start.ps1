# Family Accounting - 启动前后端服务（PowerShell）
# 用法: .\start.ps1
# 前端 → http://localhost:5174
# 后端 → http://localhost:5000

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Family Accounting - 启动服务" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 辅助函数：停掉指定端口的旧进程 ──
function Stop-ProcessByPort($port) {
    $result = netstat -ano | Select-String ":$port\s"
    foreach ($line in $result) {
        if ($line -match "LISTENING\s+(\d+)$") {
            $foundPid = $Matches[1]
            Write-Host "  [!] 端口 ${port} 已被 PID=${foundPid} 占用，正在停止..." -ForegroundColor Yellow
            taskkill /F /PID $foundPid 2>$null
            if ($?) {
                Write-Host "  [✓] 已停止旧进程" -ForegroundColor Green
            } else {
                Write-Host "  [✗] 无法停止 PID=${foundPid}" -ForegroundColor Red
            }
            Start-Sleep -Seconds 1
        }
    }
}

# ── 启动后端 (Flask :5000) ──
Stop-ProcessByPort 5000
Write-Host "[1/2] 启动后端 (Flask API → :5000)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    python app.py
} -ArgumentList $BackendDir

# ── 启动前端 (Vite :5174) ──
Stop-ProcessByPort 5174
Write-Host "[2/2] 启动前端 (Vite dev → :5174)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $FrontendDir

Write-Host ""
Write-Host "服务启动中，请稍候..." -ForegroundColor Gray
Start-Sleep -Seconds 4

# 检查后端
$backendState = $backendJob.State
if ($backendState -eq "Failed") {
    $err = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
    Write-Host "[错误] 后端启动失败:" -ForegroundColor Red
    Write-Host $err -ForegroundColor Red
} else {
    Write-Host "[✓] 后端服务 → http://localhost:5000" -ForegroundColor Green
}

# 检查前端
$frontendState = $frontendJob.State
if ($frontendState -eq "Failed") {
    $err = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "[错误] 前端启动失败:" -ForegroundColor Red
    Write-Host $err -ForegroundColor Red
} else {
    Write-Host "[✓] 前端服务 → http://localhost:5174" -ForegroundColor Green
}

Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Cyan
Write-Host ""

# 持续输出日志
while ($true) {
    $bOut = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
    $fOut = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
    if ($bOut) { $bOut -split "`r`n" | ForEach-Object { if ($_) { Write-Host "[后端] $_" -ForegroundColor DarkYellow } } }
    if ($fOut) { $fOut -split "`r`n" | ForEach-Object { if ($_) { Write-Host "[前端] $_" -ForegroundColor DarkGreen } } }
    if ($backendJob.State -in @("Completed","Failed") -or $frontendJob.State -in @("Completed","Failed")) {
        Write-Host "[!] 服务已停止: 后端=$($backendJob.State) 前端=$($frontendJob.State)" -ForegroundColor Red
        break
    }
    Start-Sleep -Milliseconds 500
}

Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
Remove-Job -Job $frontendJob -ErrorAction SilentlyContinue
Write-Host "服务已停止。" -ForegroundColor Gray

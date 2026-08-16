# 一键重启 dsh（根治画布 bundle 缓存问题）
# 用法：右键此脚本 → 使用 PowerShell 运行（或在终端执行 powershell -File scripts/restart-dsh.ps1）
# 效果：杀掉 3080 旧实例 → 重新启动 dsh web（全新 manifest/rev）→ 浏览器强制刷新即可看到最新画布
$ErrorActionPreference = "Stop"

Write-Host "=== 停止旧 dsh（3080） ==="
$conn = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $pid3080 = $conn.OwningProcess
  Write-Host "杀进程 $pid3080 ..."
  Stop-Process -Id $pid3080 -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} else {
  Write-Host "3080 无监听（可能已停）"
}

Write-Host "=== 启动新 dsh web（分离进程） ==="
# 分离启动（独立于本脚本进程，脚本退出后 dsh 继续运行）
$dsh = "dsh"
$log = Join-Path $PSScriptRoot "..\dsh-restart.log"
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "dsh web *> '$log' 2>&1" -WindowStyle Hidden
Write-Host "等待 3080 就绪 ..."
$deadline = (Get-Date).AddSeconds(40)
$ok = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3080" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { Start-Sleep -Milliseconds 1500 }
}
if ($ok) {
  Write-Host "=== 重启成功：http://127.0.0.1:3080 已就绪 ==="
  Write-Host "现在请：关闭浏览器里的 3080 标签页重新打开（或 Ctrl+Shift+R 硬刷新）"
  Write-Host "打开画布后，标题旁应看到版本标记 v3.2，操作栏图标默认灰色（hover 白色）"
} else {
  Write-Host "=== 重启失败：40 秒内 3080 未就绪，请查看日志 $log ==="
}

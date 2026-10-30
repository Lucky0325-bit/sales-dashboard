# 本地启动脚本
# 作用：在项目根目录起一个静态服务器，浏览器访问 http://127.0.0.1:8080 即可查看看板
# 说明：因为页面用 fetch 读取 data/sales.csv，直接双击 index.html（file:// 协议）会被浏览器
#       的跨域策略拦截，所以必须通过 http 服务打开。

param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host " 销售经营看板" -ForegroundColor Cyan
Write-Host " 服务地址: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host " 按 Ctrl + C 停止服务" -ForegroundColor DarkGray
Write-Host ""

# 优先使用 Node（无需额外安装依赖，手写一个极简静态服务器）
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    Write-Host "[1/2] 使用 Node.js 启动静态服务器…" -ForegroundColor DarkGray
    node "$PSScriptRoot\serve.js" $Port
    exit $LASTEXITCODE
}

# 回退：使用 Python 内置 http.server
$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) {
    Write-Host "[1/2] 未找到 Node，改用 Python 内置服务器…" -ForegroundColor DarkGray
    Start-Process "http://127.0.0.1:$Port"
    python -m http.server $Port --bind 127.0.0.1
    exit $LASTEXITCODE
}

Write-Host "未检测到 Node.js 或 Python，请先安装其中之一。" -ForegroundColor Red
Write-Host "下载地址: https://nodejs.org/zh-cn" -ForegroundColor Yellow

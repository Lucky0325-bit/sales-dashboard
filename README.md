# 销售经营看板 · Sales Dashboard

一个零构建、零后端的纯前端数据看板。读取 CSV 销售明细，在浏览器内完成
**清洗 → 筛选 → 聚合 → 可视化**，输出可交互的多维度经营分析视图。

- 无需安装任何依赖，克隆或下载后一个命令即可运行
- 图表库 Chart.js 已本地内置，**离线也能用**
- 数据由脚本生成、随机种子固定，任何人复现的结果完全一致

---

## 一、这个项目能做什么

页面围绕经营分析中最常见的四个问题组织：

| 你想知道 | 看哪里 | 怎么用 |
| --- | --- | --- |
| 整体做得怎么样？ | 顶部 5 张指标卡 | 销售额、毛利额、毛利率、订单数、客单价，附最近完整月份环比 |
| 趋势在变好还是变坏？ | 销售额趋势图 | 点「日 / 周 / 月」切换时间粒度；虚线段表示不完整的统计周期 |
| 钱从哪里来？ | 下方三张分布图 | 区域占比（环形）、渠道销售与毛利率（双轴柱线）、品类排名（条形） |
| 具体是哪些订单？ | 明细数据表 | 点表头排序，点「上一页 / 下一页」翻页，每页 20 行 |

顶部提供 **区域 / 渠道 / 品类** 三个下拉筛选，选中后所有图表和表格**联动刷新**；
点「重置筛选」恢复全部数据。

## 二、如何运行

### 环境要求

Node.js 14+ 或 Python 3，二选一即可。
（都没装？Node 下载：<https://nodejs.org/zh-cn>）

### 启动

在项目根目录打开终端，任选一种方式：

```bash
# 方式一：Node（推荐，项目自带零依赖服务器）
node serve.js 8080

# 方式二：Windows 一键启动（自动检测 Node 或 Python）
.\start.ps1

# 方式三：Python
python -m http.server 8080
```

然后浏览器打开 <http://127.0.0.1:8080>。

> **为什么不能直接双击 `index.html`？**
> 页面用 `fetch` 读取同目录的 `data/sales.csv`，在 `file://` 协议下会被浏览器的
> 同源策略拦截，你会看到"数据加载失败"。必须通过 HTTP 服务打开——这也是项目
> 自带 `serve.js` 的原因。

### 运行测试（可选）

```bash
node serve.js 8099        # 第一个终端，起服务
node tests/smoke.js       # 第二个终端，跑测试
```

测试覆盖：静态资源可达性、CSV 结构完整性（表头 / 行数 / 脏行）、无头浏览器渲染检查。
全部通过会输出 `9/9 项通过`。

## 三、如何上传到自己的 GitHub 仓库

### 需要上传什么

**整个项目文件夹的全部内容**，包括隐藏文件夹 `.github`：

```
sales-dashboard/
├── .github/workflows/deploy.yml   ← GitHub Pages 自动部署配置（必须上传）
├── .gitignore
├── README.md
├── index.html
├── assets/
│   ├── app.js
│   ├── gen_data.py
│   ├── style.css
│   └── vendor/chart.umd.js        ← 必须上传，离线运行全靠它
├── data/sales.csv                 ← 必须上传，页面数据源
├── serve.js
├── start.ps1
└── tests/smoke.js
```

注意三点：

1. `.github` 和 `.gitignore` 以 `.` 开头，Windows 资源管理器默认**看不到**。
   查看 → 勾选「隐藏的项目」即可显示。漏传 `.github` 会导致在线预览功能失效。
2. 不要上传：临时截图、日志、`node_modules`（本项目没有）等无关文件。
3. 仓库可见性选 **Public**，否则别人打开链接会 404。

### 方式 A：网页拖拽上传（最简单，推荐新手）

全程不需要安装任何工具，5 分钟搞定：

1. 登录 <https://github.com>，右上角 **+** → **New repository**
2. Repository name 填 `sales-dashboard`，可见性选 **Public**
3. **不要勾选** "Add a README file"（勾了会造成冲突，见下方 FAQ）
4. 点 **Create repository**
5. 在新仓库页面中间找到 **uploading an existing file** 链接，点击进入上传页
6. 打开本地的 `sales-dashboard` 文件夹，**全选里面的所有文件和文件夹**（含 `.github`），
   拖到浏览器上传区，等待上传完成
7. 页面底部 Commit changes 输入框填 `init: 销售经营看板`，点 **Commit changes**
8. 刷新仓库页面，逐个点开 `.github/workflows/deploy.yml`、`assets/vendor/chart.umd.js`
   确认都传上去了

### 方式 B：Git 命令行

```powershell
# ① 首次使用先配置身份（只需一次）
git config --global user.name "你的名字"
git config --global user.email "你的GitHub邮箱"

# ② 进入项目目录，初始化并提交
cd 项目所在路径\sales-dashboard
git init
git branch -M main
git add .
git commit -m "init: 销售经营看板"

# ③ 关联远端并推送（URL 换成你自己仓库的地址）
git remote add origin https://github.com/你的用户名/sales-dashboard.git
git push -u origin main
```

> **首次 push 会要求登录。** GitHub 已不支持密码，需要 Personal Access Token：
> <https://github.com/settings/tokens> → Generate new token (classic) → 勾选 `repo`
> 权限 → 生成后**立刻复制**（只显示一次）。弹窗里 Username 填 GitHub 用户名，
> Password 粘贴这串 `ghp_` 开头的 token。
>
> **嫌麻烦就用方式 A 或方式 C**，完全绕开 token。

### 方式 C：GitHub Desktop（图形界面）

下载 <https://desktop.github.com/>，登录账号后：
File → Add local repository 选中项目文件夹 → Commit to main → Publish repository。全程点鼠标。

### 上传之后：开启在线预览（可选但推荐）

仓库里已经内置了自动部署配置，开两处开关就能得到一个公开访问的网址：

1. 仓库 → **Settings** → 左侧 **Pages** → Source 选 **GitHub Actions**
2. 仓库 → **Actions** 标签页 → 左侧 **Deploy to GitHub Pages** → 右侧 **Run workflow**

1～2 分钟后访问：

```
https://你的用户名.github.io/sales-dashboard/
```

### 常见问题

| 报错 / 现象 | 原因与解决 |
| --- | --- |
| 推送被拒 `non-fast-forward` | 建仓库时勾了 README，远端已有提交。执行 `git push -u origin main --force` |
| `remote origin already exists` | 之前关联过远端。改用 `git remote set-url origin <URL>` |
| `dubious ownership in repository` | Git 安全保护。按提示执行 `git config --global --add safe.directory <项目路径>` |
| 网页上看不到 `.github` 文件夹 | 隐藏文件。上传方式 A 中若没拖进去，可在上传页手动 **Add file → Upload files** 补传 |
| Pages 打开 404 | 等 2 分钟；或检查 Settings → Pages 的 Source 是否为 GitHub Actions |

## 四、项目结构与技术栈

```
sales-dashboard/
├── index.html              页面骨架（语义化 + aria 标注）
├── assets/
│   ├── style.css           CSS 变量设计令牌 + Grid/Flex 布局 + 三档响应式
│   ├── app.js              数据管道、聚合、图表、表格（全部业务逻辑）
│   ├── gen_data.py         数据生成脚本（固定随机种子，可复现）
│   └── vendor/chart.umd.js Chart.js v4.4.1 本地副本
├── data/sales.csv          销售明细，1,525 行
├── tests/smoke.js          冒烟测试
├── serve.js                零依赖静态服务器（Node）
├── start.ps1               Windows 一键启动
└── .github/workflows/      GitHub Pages 部署工作流
```

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 结构 | HTML5 | 语义化标签、`aria-label` |
| 样式 | 原生 CSS | CSS 变量做设计令牌，Grid + Flexbox，1080/720 两档断点 |
| 逻辑 | 原生 JavaScript ES6+ | 无框架，IIFE 封装作用域，`Map` 做聚合 |
| 图表 | Chart.js 4.4.1 | 本地 vendor 引入，不依赖 CDN |
| 数据 | CSV | 人类可读，可用 Excel 直接打开核对 |

### 核心设计：单向数据管道

```
data/sales.csv
      │  fetch + parseCSV()      解析、显式类型转换、丢弃脏行
      ▼
  state.raw[]                    原始记录（1,525 行）
      │  applyFilters()          按区域/渠道/品类过滤
      ▼
state.filtered[]                 筛选后的记录
      │  groupSum() + timeKey()  分组求和、时间分桶
      ▼
    聚合结果 ──→ 5 个渲染函数（KPI / 趋势 / 区域 / 渠道 / 品类 / 表格）
```

每次筛选变化都从 `state.raw` **重新计算**一份 `state.filtered`，而不是在上一次图表数据上
做增量修改。单向、无回写，避免"筛了又筛导致数据漂移"；代价只是十几毫秒重算。

### 几个关键取舍

| 问题 | 做法 | 原因 |
| --- | --- | --- |
| 图表反复创建导致内存泄漏、动画闪烁 | `upsertChart()` 复用 Chart 实例，只换数据再 `update()` | 筛选是高频操作，反复 `new Chart()` 会不断累加实例 |
| CSV 数值列可能是字符串，`+=` 变成拼接 | `parseCSV()` 中显式 `Number()` 转换 | 这类静默失败表现为"图表全空"，最难排查 |
| 数据末尾有不完整月份（如只含 1 天） | 趋势图末段虚线 + 菱形点标注；环比只取天数 ≥ 10 的完整月份 | 连实线会画出假断崖，误导阅读 |
| 多时间粒度需求 | `timeKey()` 按粒度返回不同键，聚合函数不变 | 一套逻辑适配日/周/月，不复制代码 |
| 明细行数多，全量渲染掉帧 | 前端分页，每页 20 行 | 1,500 行全量 DOM 在低端机明显卡顿 |

## 五、数据集说明

`data/sales.csv` 覆盖 2026-01-01 至 2026-10-31，共 9 个字段、1,525 条记录：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `date` | string | 日期，`YYYY-MM-DD` |
| `region` | string | 区域（华北 / 华东 / 华南 / 华中 / 西南） |
| `city` | string | 城市 |
| `channel` | string | 渠道（线上商城 / 门店零售 / 分销渠道 / 企业采购） |
| `category` | string | 商品品类 |
| `unit_price` | number | 单价（元） |
| `qty` | number | 数量 |
| `amount` | number | 销售额（元） = 单价 × 数量 |
| `profit` | number | 毛利额（元） |

数据由脚本生成，并注入了真实数据中常见的三种特征，让看板有内容可看：

- **季节性**：6 月、11 月促销月系数放大到 1.45 / 1.62，形成双峰
- **周末效应**：周末系数 1.18
- **结构性差异**：华东 / 华南权重更高；渠道毛利率基准不同（门店 > 线上 > 企业采购 > 分销）

重新生成（结果与仓库中的完全一致，随机种子固定为 `20261030`）：

```bash
python assets/gen_data.py
```

## 六、已知限制

本项目有意保持简单，以下均未实现：

- CSV 解析按逗号切分，不支持字段内含逗号、换行或转义引号（完整实现需 RFC 4180）
- 数据全量载入内存，十万行以上需要分块或虚拟滚动
- 无持久化，刷新即重置筛选条件
- 未做汇总下钻（如点击区域下钻到城市）

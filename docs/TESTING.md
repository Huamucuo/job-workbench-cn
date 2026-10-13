# 测试范围

## 0.4.2 Beta 公开下载

当前结果见 [公开下载验收](beta/公开下载验收-0.4.2.html)。普通用户仅使用发行包的 EXE 和图文教学，下述命令只供维护者复现。

- `tests/onboarding-browser.mjs <Bundle>`：隔离 Edge 和 Chrome 真实加载 MV3，缺失状态、安装后一次检查、直接打开统一档案、免口令 DOCX 导入保存与重开，三种宽度检查。CDP 在隔离浏览器加载扩展，不代表日常浏览器的手动安装已经完成。
- `tests/optional-protection.browser.mjs <Bundle>`：实际免口令导入、修改、填写、已有输入保护、未加密备份、可选保护与正确/错误口令、关闭保护、恢复先预览、网页不能读取本机访问资料、零外部 HTTP/POST/自动提交。
- `tests/crosspage-browser.mjs --password-free --no-supplement`：默认免口令完整六 URL 和同网址步骤；保留 DOM/model/saved、身份真值、5分钟/30分钟规则与页授权边界。去掉 `--password-free` 则测旧保护模式；补充场景去掉 `--no-supplement`。
- `scripts/test-windows-launcher.ps1 -Bundle <FreshlyExtracted>`：必须对真实 ZIP 全新解压目录运行，且不与其他服务抢占47841。安装助手 `/describe` 为检查目录与浏览器位置，不模拟本人手动选择文件夹。

历史原37项 =30项扩展/模拟表单 +7项工作台记录。历史岗位时间已过72小时，回归明确通过“含待核验公告”查看，不修改快照时间或状态；历史岗位文件只读、不随源码或ZIP发布。隔离浏览器目录应保持短路径，Windows LevelDB可能遇到260字符限制。


0.4.1跨页候选的现行验收见 `docs/beta/跨页验收报告.html`，下方有注明日期的记录属于历史版本。新浏览器运行必须记录所有sidepanel/controller/policy/watcher/manifest资产hash，不能复用旧Beta通过数。

现行维护入口：`tests/crosspage-browser.mjs --headful --idle`（真实MV3工具栏侧栏、六URL及同地址步骤、独立DOM/model/saved、额外安全场景与真实5分钟闲置）；`tests/engine-operation-cancel.browser.mjs`（实际隔离世界等待/取消/变化回归）；`tests/page-watch.browser.mjs`（观察器只读与标识）；`tests/session-lifetime.test.mjs`（执行真实controller源码的可控异步API适配，不能冒充浏览器证据）。

原核心回归仍执行 `tests/beta-browser-original.mjs` + `tests/beta-browser-workbench.mjs`。N03只增加固定sidepanel.html的sidePanel界面权限，保留来源/端口/顶层/不越权检查；参考fixtures/v021字节不变。WorkBench回归改用自己的47963端口，不测试仍运行的0.4.0旧服务。47943原故意网络风险接收端必须只监听127.0.0.1；环境权限阻止时先明确分类，不能把没跑当通过。

## Beta RC1 当前实际证据

2026-10-12本机Node24.17/运行时24.19；隔离Edge155.0.4283.45、Playwright1.62.1。单元81/81通过。原37项独立验收重新执行37/37；新增实际MV3资料/复杂控件32/32、授权桥11/11，合计80/80。完整结果、初次失败与修复对应、截图和未达项见[Beta报告](beta/验收报告.html)。后文44/44是公开源码准备的历史基线，不能冒充当前结果。

维护者运行浏览器脚本前先启动本机Beta47841，准备安装的Playwright与Microsoft Edge（不使用日常profile）。不把浏览器测试加入普通用户操作步骤：

~~~text
node tests/beta-browser-profile.mjs beta-profile-final
node tests/beta-browser-bridge.mjs beta-bridge-final
node tests/beta-browser-original.mjs beta-original-final .
node tests/beta-browser-workbench.mjs beta-workbench-final .
node --test tests/beta-engine.browser.mjs
node scripts/audit-release.mjs
~~~

Playwright路径可以用BETA_PLAYWRIGHT指定，原虚构QA参考默认tests/fixtures/v021，可用BETA_ORIGINAL_QA_ROOT改为原只读交付目录。历史7项岗位回归需BETA_HISTORICAL_JOBS显式指向原私有511条快照，不将其放进Git或ZIP；缺少它就标待测，不能用假数据宣称原7项已经重跑。个人浏览器不被使用。截图与HAR、加密虚构档案留在.local，公开前仍需逐个核验范围。

H01真人计时保持历史SKIP，2026-10-12用户明确免除；H02是自动化同条件对照，1660ms/4785ms不证明真人节时30%。R01真实招聘站点仍待验证，不为满足数字而提交真实或虚构申请。React/Vue只用相似受控模型fixture核对，不声称已验证整个框架生态。

Windows维护者可运行scripts/test-windows-launcher.ps1：只测发行目录启动器，检查进程真实路径/loopback/目录/四入口，再由启动器自身检查PID+路径+启动时间停止自己的服务。默认不打开日常浏览器；-ShowBrowser仅验证启动器要求浏览器打开本机首页。它不证明扩展已安装到日常Edge。

## v0.3.0公开源码准备的历史结果

离线使用虚构输入，不访问真实网站、上传简历或自动投递。本机与 CI 执行：

~~~text
npm run prepare:local
node scripts/syntax-check.mjs
npm test
npm run validate
npm run build:extension
npm run package:extension
npm run build
~~~

空数据校验不证明真实岗位覆盖；构建不证明真实网站兼容。

2026-10-12 本轮在隔离公开副本、Node.js 24.17.0 下实际重跑：44/44 测试通过，失败/跳过/取消均为 0；脚本语法、空数据契约、扩展构建、ZIP 回读和本机静态构建均通过。重复初始化前后三个文件的哈希不变。公开部署检查按预期以代码 2 拒绝，门禁保持关闭。这些结果不改变下述浏览器与网站限制。

历史 v0.3.0 共用引擎网页演练 A 9/9、B 18/18、C 19/19，合计 46/46；C 含人工映射。私有原始证据不随源码分发，这不是本轮重新执行的浏览器/网站测试。

日常浏览器安装、扩展上下文 PDF worker、工具栏扩展填表及真实控件仍待验收；没有真人手填时间基线。GitHub Actions 尚未在远程实际执行，批准上传后确认。Stable 需补齐安装、数据保存恢复、误填保护和迁移验收。

## 本轮简化的最终语义

新用户从首页直接打开固定扩展options。open-profile仅UI能力，不读档案、不批准会话、不设置共享标记；storage:*仍需精确页授权。旧本机档案必须明确选择迁移或离线。link仅申请并提示真实toolbar手势，不自动打开缺少activeTab的弹窗。导入主操作审核后apply+save，secondary草稿路径位于#resume-advanced；失败保留dialog/候选，CAS不覆写新master。空gate#start-resume-import直接打开真实picker，备份入口仍#import（恢复加密备份）。

追加复现：tests/import-confirm.browser.mjs（自有47950）、tests/beta-enhanced-files.browser.mjs（47950）、tests/beta-browser-simple-ux.mjs（47841）、tests/beta-workbench-empty.browser.mjs（47951）、scripts/test-windows-launcher-conflict.ps1。不要并行抢同端口；QA输出label尽量短，过长Windows profile路径实际触发过LevelDB 260字符写入限制。原失败记录和字段真值保留。Windows停止操作只由该版本自己的启动器执行。

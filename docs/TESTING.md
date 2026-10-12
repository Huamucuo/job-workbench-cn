# 测试范围

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

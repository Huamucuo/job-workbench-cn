# 测试范围

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

# 架构

本机静态网页 + 仅监听 127.0.0.1 的 Node.js 服务。岗位数据与个人记录分离，收藏和投递状态不写入岗位 JSON。

public/autofill 提供档案、加密 vault、规则、填表引擎和导入预览；扩展构建复用模块。网页和扩展存储隔离，通过用户主动导出的加密备份迁移。

DOCX 用 fflate 提取 XML；PDF 用本地 PDF.js 与 worker 提取文字，不使用 CDN/外部 AI，不执行简历宏或外链。导入先形成草稿与来源，确认后保存有效档案。

公开源码不附真实岗位；初始化创建空的被忽略文件。sources/registry.json 保留接口与许可状态，config/release.json 公共部署门禁保持关闭。

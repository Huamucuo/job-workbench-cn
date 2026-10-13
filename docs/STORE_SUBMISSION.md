# 扩展商店上架准备

GitHub 下载版已经设计安装助手及离线图解，但浏览器仍要求本人加载扩展。真正的商店“一键添加”需要作者在 Microsoft Partner Center / Chrome Web Store 创建开发者账号、填写资料并通过平台审核，不能把 GitHub ZIP 冒充商店安装。

本项目不替作者接受平台法律协议、填写个人地址或购买注册服务。本版不宣称商店已上架。

## 可直接使用的说明

名称：职有引力 · 本机求职填表

简述：在本机导入、核对并保存一份求职档案，默认免口令、保护可选，招聘页面逐页预览后复用；不自动提交申请。

核心用途：减少本人在不同招聘表单中重复输入。支持 DOCX、文字版 PDF、多条经历和用户修改；跨页自动准备预览，但每页填写由本人确认，保存、下一步和最终提交由本人执行。Beta 的实测范围是虚构资料与模拟表单，真实网站存在未支持结构。

隐私说明公开 URL： https://github.com/Huamucuo/job-workbench-cn/blob/main/PRIVACY.md

权限理由：activeTab 仅在本人点击扩展后访问当前页；scripting 在获准页面识别和写入本人选定字段；storage 保存本机档案、字段对应关系和无明文的会话元数据；sidePanel 保持本人打开的填写侧栏。没有招聘网站通配 host 权限。127.0.0.1 内容脚本再严格限制本机工作台端口、路径和顶层来源。

远程代码：不加载。PDF.js、fflate、字体资源全部随包提供，保留第三方许可证。

测试资料：public/autofill/samples 中明确标注虚构的 DOCX/PDF。默认免口令，开启保护时自行设置测试口令，不提交任何真实或虚构正式申请。

商店 ZIP 需把 extension 文件夹的内容放在 ZIP 根目录，使 manifest.json 在根层；不要把 Windows EXE、个人档案或整个 Windows 下载包上传商店。图标提供 16/32/48/128 PNG，截图见 public/help/onboarding。

参考： [Microsoft Edge 发布流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)，[Chrome 开发者账号注册](https://developer.chrome.com/docs/webstore/register)。Chrome 作者注册需要一次性费用，不是求职者使用本工具的费用。

# 虚构测试文档来源

四份样例均由项目开发阶段的自制脚本生成，正文明确虚构，使用示例邮箱；没有下载个人简历或第三方简历模板。原生成脚本 SHA-256：`bf381658cbdb23a0f8527e0a023ae77416291213591def1c5a4cd7433f3efcdd`。原执行记录成功创建一份 DOCX、两份文字 PDF 和一份图片式 PDF；四份原件与生成副本逐字节一致。

DOCX 没有嵌入字体文件。两份文字 PDF 仅嵌入 Windows Microsoft YaHei 6.31 的字形子集；生成脚本实际通过 ReportLab 注册系统字体并以虚构正文创建文档。三个字体子集的 OS/2 与 name 表共六项哈希核对与原系统字体一致，保留原版权和字体嵌入说明。fsType 为 `0x0008`，没有禁止嵌入位。图片式 PDF 的文字作为测试图像渲染。

这属于许可条件下的文档嵌入，不是独立字体软件的分发授权。项目 MIT 不重新授权 Microsoft/Founder 字体；仓库不包含系统字体原文件，不提供从 PDF 提取字体用于其他用途的授权。重新制作样例时，应使用合法取得且允许相应用途的字体，并重新记录来源和元数据。

依据：[Microsoft 字体与嵌入 FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq)、[OpenType OS/2 fsType](https://learn.microsoft.com/en-us/typography/opentype/spec/os2#fstype)。运行时随包的 Liberation 字体是另一组资源，GPLv2 与字体例外及其完整对应源码按 THIRD_PARTY_NOTICES.md 提供。

隐私检查覆盖 DOCX/PDF 元数据、正文、链接和活动内容，并目检了图片样例。公开帮助图中带有本机安装路径的那一张已排除；保留的十二张只包含虚构验收内容。私人生成路径、用户截图和本机日志不随本文件公开。

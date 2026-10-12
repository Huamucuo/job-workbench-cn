# 自动填写契约 v0.2.1

主实现：public/autofill；扩展构建逐字复制共享模块。旧 v1 只有预留结构、没有已实现档案数据；v2 严格校验导入，不擅自把旧 contact/experience 猜成新记录。

## 本机档案
ResumeProfile v2 见 resume-profile.schema.json。每类经历最多30条、有稳定 id；列表顺序就是使用者核对的经历顺序。英文名和英文姓由本人录入，不从中文姓名拆分猜测。日期保留年月/年月日精度。不得把缺失经历、学校、岗位、证书或日期补出来。

持久化的有效档案是 job-workbench-encrypted-profile 封包。未完成草稿使用不同 kind 和不同 AES-GCM additionalData（job-workbench-encrypted-draft）；自动填写解密入口拒绝草稿。口令/密钥不落盘。跨标签保存使用 Web Locks 与密文版本比较；加密恢复草稿列表按独立 ID 保存，最多20份，不覆盖别的窗口草稿。默认导出加密 JSON，可在编辑器导入预览、确认保存。

## 扫描与执行
scan() 返回 scanId、精确 origin+pathname 的 scope、url、expiresAt、fields、groups、unsupported。
FieldDescriptor 包括 id、label、name、placeholder、type、context、safetyContext、group、index、autocomplete、disabled、readOnly、maxLength、options、hasValue、ambiguousGroup。没有密码、隐藏字段、已有个人值或整份简历。
原生多选 options 为 value/label/disabled。内容脚本仅在内存保存非保护字段的原始值作竞态检查；不写入日志、磁盘或发到扩展面板。

apply(scanId, [{fieldId, value, overwrite, deferred?, anchors?}]) 接收确认选择的写入值。anchors仅附带下级所需、已在预览中显示的父级fieldId与档案对应的原生选项值，用于只读比对，不能触发父级写入；除这些依赖核对值外不传递未选择资料。令牌2分钟有效、一次性使用。执行时检查当前网址、元素引用、分组、字段语义/选项及原有值；改变则跳过。通过原生 setter 和 input/change 事件写入，再回读核对；多选按集合比较。返回字段结果、写入耗时及 automaticSubmitRequested:false。这个标志只代表助手没有主动提交，不代表监听了招聘网站的网络请求。

prepareGroups({education:2, work:1, ...}) 仅接收数量，不接收简历内容；最多新增5次，只点击唯一、明确新增经历、type=button 的控件，每次检查分组数是否恰好加一。失败时停止，用户可手工加组。多步骤永远由本人点击下一步，再识别、核对。

规则记忆是 {scope, signature, path}，只存本机，不含简历值。路径仅白名单字段；保护字段、禁用字段和不支持控件不能靠手工映射绕过。记录增删、页面顺序变化之后仍需检查预览所指的第几条经历。无明确经历边界的学校/学历不猜第一条；折叠无序号经历有歧义则人工处理。

## 可选 AI 的未来接口（未启用、没有调用实现）
可选建议提供者只能返回 {fieldId, suggestedPath, reason, requiresReview:true}。调用前必须明确列出服务商、出站字段和费用，由本人另行启用。建议不能直接触发 apply，不能突破保护字段，不能取代核对。当前版本没有服务端、API Key 输入、远程请求或 AI 依赖。

## 最小权限
MV3：activeTab、scripting、storage。只注入主框架 ISOLATED world；仅当前激活页；无后台全站扫描、永久 host_permissions、externally_connectable、远程脚本。扩展 storage.local 限 TRUSTED_CONTEXTS。弹窗关闭即丢失解锁状态。只允许 HTTPS 或本机 HTTP 页面；浏览器内置页不可操作。


## v0.2.1 修复扩展

contact 新增可选 gender、politicalStatus、province、district；旧 schemaVersion:2 输入缺失时转为空串。新增内容仍通过原 AES-GCM 存储、草稿校验与导出流程；不接受独立验收 truth 文件中的 requiredAdditional/notice 原样作为有效档案。应在编辑器补充或把明确提供的值放入 contact 白名单字段。

受保护上下文扩展到家庭成员、亲属、父母、配偶、监护人、社会关系及英文对应词；Family name 仍映射申请人的英文姓。整张表的所有数据行都具备多个明确字段和记录主体，且同一区域没有表外控件时，才以行为记录边界。单条经历的字段分散在多行但各字段唯一时退回父级分组；混合布局整体标为歧义。隐藏且无序号的行不猜记录。

FieldDescriptor 可附加 cascade:{parentId,path}，仅用于同一语义区域内唯一的原生省市区下拉。预览可以生成 deferred:{path}；此时 value 是使用者核对过的目标地区文字，其他字段仍是已转换的原生值。apply 只在本次父项已成功填写、下级选项确实发生更新、连续稳定200ms、唯一匹配后赋值。任意祖先、节点、类型、标签、所属区域、已有值变化会停止；每级等待上限3500ms，未勾选父项不得自动连带填写。若已有上级与档案完全一致且下级已加载唯一选项，可通过anchors递归只读核验祖先，不重填父项；该路径不得冒充父项触发了更新。完整链在结果回读时再次核对。观察器在执行结束后断开。

prepareGroups 每次点击后等待分组数恰好加一且字段结构稳定200ms，上限3500ms，单次最多5次。超时记录保留在当前页引擎内存，避免重复点击尚未确认的新增操作；URL变化或计数明确增长后才解除。scan 在新增进行中拒绝生成不完整预览。每组及每次点击前检查URL，页面切换终止整个新增操作。面板显示具体失败原因。

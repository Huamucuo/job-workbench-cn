using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;
class JobLauncher {
 static string root=AppDomain.CurrentDomain.BaseDirectory;
 static string url="http://127.0.0.1:47841";
 static string record=Path.Combine(root,".local","windows-server.json");
 static Dictionary<string,object> Health(){try{var req=(HttpWebRequest)WebRequest.Create(url+"/__health");req.Proxy=null;req.Timeout=500;using(var resp=req.GetResponse())using(var r=new StreamReader(resp.GetResponseStream()))return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(r.ReadToEnd());}catch{return null;}}
 static bool Ours(Dictionary<string,object> h){return h!=null&&h.ContainsKey("app")&&h.ContainsKey("version")&&h.ContainsKey("pid")&&Convert.ToString(h["app"])=="job-workbench-cn"&&Convert.ToString(h["version"])=="0.4.1-beta.1";}
 static void Stop(){if(!File.Exists(record))return;var saved=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(record));var h=Health();if(!Ours(h)||Convert.ToInt32(h["pid"])!=Convert.ToInt32(saved["pid"]))throw new Exception("当前服务与本发行目录的记录不一致，未停止。请先关闭其他工作台版本。");var p=Process.GetProcessById(Convert.ToInt32(saved["pid"]));if(!String.Equals(p.MainModule.FileName,Path.Combine(root,"runtime","node.exe"),StringComparison.OrdinalIgnoreCase)||p.StartTime.ToUniversalTime().Ticks!=Convert.ToInt64(saved["startedTicks"]))throw new Exception("进程来源不一致，未停止其他程序。");p.Kill();p.WaitForExit(3000);}
 [STAThread] static int Main(string[] args){bool quiet=Array.IndexOf(args,"/nobrowser")>=0;try{
  if(Array.IndexOf(args,"/stop")>=0||Path.GetFileName(Application.ExecutablePath).Contains("停止")){Stop();if(!quiet)MessageBox.Show("本机工作台已停止。浏览器中的个人档案保留。","职有引力");return 0;}
  var h=Health();if(h!=null&&!Ours(h))throw new Exception("47841端口已有其他版本或程序。请先停止它，再启动当前Beta。");
  if(Ours(h)){var running=Process.GetProcessById(Convert.ToInt32(h["pid"]));if(!String.Equals(running.MainModule.FileName,Path.Combine(root,"runtime","node.exe"),StringComparison.OrdinalIgnoreCase))throw new Exception("另一份Beta工作台正在运行。请用它自己的停止工作台.exe关闭，再打开当前目录，避免用错安装文件夹。");}
  if(h==null){string node=Path.Combine(root,"runtime","node.exe"),script=Path.Combine(root,"scripts","serve.mjs");if(!File.Exists(node)||!File.Exists(script))throw new Exception("发行文件不完整。请先把整个ZIP全部解压，再双击开始使用.exe。");Directory.CreateDirectory(Path.Combine(root,".local"));var si=new ProcessStartInfo(node,"\""+script+"\"");si.WorkingDirectory=root;si.UseShellExecute=false;si.CreateNoWindow=true;si.WindowStyle=ProcessWindowStyle.Hidden;si.EnvironmentVariables["JOB_WORKBENCH_PORT"]="47841";var p=Process.Start(si);for(int i=0;i<30;i++){Thread.Sleep(150);h=Health();if(Ours(h))break;if(p.HasExited)break;}if(!Ours(h))throw new Exception("本机工作台未能启动。请检查文件夹是否可写，或47841端口是否被占用。");if(Convert.ToInt32(h["pid"])!=p.Id)throw new Exception("启动时发现其他工作台实例，未记录或停止它。请关闭重复版本后重试。");File.WriteAllText(record,new JavaScriptSerializer().Serialize(new {pid=p.Id,startedTicks=p.StartTime.ToUniversalTime().Ticks}));}
  if(!quiet)Process.Start(new ProcessStartInfo(url){UseShellExecute=true});return 0;
 }catch(Exception e){try{Directory.CreateDirectory(Path.Combine(root,".local"));File.WriteAllText(Path.Combine(root,".local","launcher-error.txt"),e.Message);}catch{}if(!quiet)MessageBox.Show(e.Message,"职有引力 · 启动提示",MessageBoxButtons.OK,MessageBoxIcon.Information);return 1;}}
}

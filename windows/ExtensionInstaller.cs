using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Win32;
class ExtensionInstaller {
 static readonly string Root=AppDomain.CurrentDomain.BaseDirectory;
 static string DirectoryPath { get { return Path.Combine(Root,"extension"); } }
 static string BrowserFile(string browser){return WindowsBrowser.Find(browser);}
 static string ManagementPage(string browser){return browser=="Chrome"?"chrome://extensions":"edge://extensions";}
 static void RequireBundle(){if(!File.Exists(Path.Combine(DirectoryPath,"manifest.json"))||!File.Exists(Path.Combine(Root,"开始使用.exe")))throw new Exception("请先解压完整下载包，再从同一文件夹双击安装扩展.exe。不要只移动或下载这个程序。");}
 static Label Text(string text,int x,int y,int width,int height,float size,bool bold){return new Label{Text=text,Left=x,Top=y,Width=width,Height=height,Font=new Font("Microsoft YaHei UI",size,bold?FontStyle.Bold:FontStyle.Regular),ForeColor=Color.FromArgb(23,68,49)};}
 static Form Build(){
  var form=new Form{Text="职有引力 · 安装扩展（只做一次）",ClientSize=new Size(810,Math.Min(680,Math.Max(420,Screen.PrimaryScreen.WorkingArea.Height-80))),StartPosition=FormStartPosition.CenterScreen,FormBorderStyle=FormBorderStyle.Sizable,MaximizeBox=true,AutoScroll=true,MinimumSize=new Size(600,420),BackColor=Color.FromArgb(242,246,237),AutoScaleMode=AutoScaleMode.None};
  form.Controls.Add(Text("安装一次，以后从工具栏填写",30,24,750,44,21,true));
  form.Controls.Add(Text("助手会复制正确目录并打开安装页；浏览器的最后三个确认由你完成。",30,78,750,46,11,false));
  var status=Text("请选择你日常投递使用的浏览器。",30,585,745,48,10,false);
  foreach(var browser in new[]{"Edge","Chrome"}){
   var button=new Button{Text="用 "+browser+" 安装（复制目录并打开安装页）",Left=30+(browser=="Chrome"?385:0),Top=132,Width=365,Height=58,Font=new Font("Microsoft YaHei UI",11,FontStyle.Bold),BackColor=Color.FromArgb(25,103,74),ForeColor=Color.White,FlatStyle=FlatStyle.Flat};
   button.Click+=(s,e)=>{try{RequireBundle();var binary=BrowserFile(browser);if(binary==null)throw new Exception("没有找到 "+browser+"。请用已经安装的浏览器，或先安装该浏览器。");Clipboard.SetText(DirectoryPath);Process.Start(new ProcessStartInfo(binary,ManagementPage(browser)){UseShellExecute=true});WindowsBrowser.Remember(Root,browser);status.Text="安装目录已复制，已打开 "+browser+" 安装页。完成下方三步后回到工作台点击检查。";}catch(Exception ex){status.Text=ex.Message;}};form.Controls.Add(button);
  }
  form.Controls.Add(Text("① 打开“开发人员模式”",30,218,745,37,15,true));
  form.Controls.Add(Text("只在浏览器扩展页面操作，不需要打开 Windows 的开发者设置。",60,260,710,32,11,false));
  form.Controls.Add(Text("② 点击“加载解压缩的扩展”",30,308,745,37,15,true));
  form.Controls.Add(Text("清空扩展页面的搜索框。不要点“探索新扩展”，本版本尚未上架商店。",60,350,710,32,11,false));
  form.Controls.Add(Text("③ 粘贴安装目录，再点“选择文件夹”",30,398,745,37,15,true));
  form.Controls.Add(Text("在弹出的文件夹窗口中点地址栏，Ctrl+V、回车，再点“选择文件夹”。",60,440,710,35,11,false));
  var pathBox=new TextBox{Text=DirectoryPath,ReadOnly=true,Left=30,Top=490,Width=745,Height=28,Font=new Font("Microsoft YaHei UI",9)};form.Controls.Add(pathBox);
  var copy=new Button{Text="重新复制目录",Left=30,Top=530,Width=190,Height=40};copy.Click+=(s,e)=>{try{RequireBundle();Clipboard.SetText(DirectoryPath);status.Text="目录已重新复制。";}catch(Exception ex){status.Text=ex.Message;}};form.Controls.Add(copy);
  var guide=new Button{Text="打开图文教学",Left=235,Top=530,Width=190,Height=40};guide.Click+=(s,e)=>{try{var p=Path.Combine(Root,"图文教学.html");if(!File.Exists(p))throw new Exception("图文教学缺失，请重新解压完整下载包。");Process.Start(new ProcessStartInfo(p){UseShellExecute=true});}catch(Exception ex){status.Text=ex.Message;}};form.Controls.Add(guide);
  var home=new Button{Text="安装后：打开工作台",Left=440,Top=530,Width=235,Height=40};home.Click+=(s,e)=>{try{RequireBundle();var start=Process.Start(new ProcessStartInfo(Path.Combine(Root,"开始使用.exe"),"/nobrowser"){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});if(!start.WaitForExit(10000)||start.ExitCode!=0)throw new Exception("本机工作台未能启动，请检查文件是否完整或是否有旧版本运行。");WindowsBrowser.Open(Root,"http://127.0.0.1:47841");}catch(Exception ex){status.Text=ex.Message;}};form.Controls.Add(home);
  form.Controls.Add(status);form.Controls.Add(Text("没有静默安装或修改浏览器设置。安装后请保留整个解压文件夹。",30,645,745,27,9,false));return form;
 }
 [STAThread] static int Main(string[] args){try{
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  RequireBundle();
  if(Array.IndexOf(args,"/describe")>=0){Directory.CreateDirectory(Path.Combine(Root,".local"));File.WriteAllText(Path.Combine(Root,".local","installation-plan.json"),new JavaScriptSerializer().Serialize(new{extensionDir=DirectoryPath,edge=ManagementPage("Edge"),chrome=ManagementPage("Chrome"),clipboardText=DirectoryPath,requiresUserConfirmation=true,modifiesRegistry=false,autoInstalls=false,workbenchBrowser=WindowsBrowser.Preferred(Root)??"system-default",edgeFound=BrowserFile("Edge")!=null,chromeFound=BrowserFile("Chrome")!=null}));return 0;}
  using(var form=Build()){if(Array.IndexOf(args,"/renderguide")>=0){Directory.CreateDirectory(Path.Combine(Root,".local"));form.ShowInTaskbar=false;form.StartPosition=FormStartPosition.Manual;form.Location=new Point(-32000,-32000);form.Show();Application.DoEvents();using(var image=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(image,new Rectangle(0,0,image.Width,image.Height));image.Save(Path.Combine(Root,".local","installer.png"));}form.Hide();return 0;}Application.Run(form);}return 0;
 }catch(Exception ex){if(Array.IndexOf(args,"/describe")<0&&Array.IndexOf(args,"/renderguide")<0)MessageBox.Show(ex.Message,"职有引力 · 安装提示");return 1;}}
}

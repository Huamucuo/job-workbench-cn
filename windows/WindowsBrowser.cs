using System;
using System.IO;
using System.Diagnostics;
using Microsoft.Win32;
static class WindowsBrowser {
 static string PreferencePath(string root){return Path.Combine(root,".local","preferred-browser.txt");}
 internal static string Preferred(string root){try{var p=PreferencePath(root);if(!File.Exists(p)||new FileInfo(p).Length>32)return null;var value=File.ReadAllText(p).Trim();return value=="Edge"||value=="Chrome"?value:null;}catch{return null;}}
 internal static void Remember(string root,string browser){if(browser!="Edge"&&browser!="Chrome")throw new Exception("请选择 Edge 或 Chrome。");Directory.CreateDirectory(Path.Combine(root,".local"));File.WriteAllText(PreferencePath(root),browser);}
 internal static string Find(string browser){
  if(browser!="Edge"&&browser!="Chrome")return null;
  string exe=browser=="Chrome"?"chrome.exe":"msedge.exe";
  foreach(var hive in new[]{RegistryHive.CurrentUser,RegistryHive.LocalMachine})foreach(var view in new[]{RegistryView.Registry64,RegistryView.Registry32})try{using(var baseKey=RegistryKey.OpenBaseKey(hive,view))using(var key=baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\"+exe)){if(key!=null){var path=Convert.ToString(key.GetValue(null)).Trim('"');if(File.Exists(path))return path;}}}catch{}
  foreach(var folder in new[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)}){var path=Path.Combine(folder,browser=="Chrome"?@"Google\Chrome\Application\chrome.exe":@"Microsoft\Edge\Application\msedge.exe");if(File.Exists(path))return path;}return null;
 }
 internal static void Open(string root,string url){var browser=Preferred(root);if(browser==null){Process.Start(new ProcessStartInfo(url){UseShellExecute=true});return;}var exe=Find(browser);if(exe==null)throw new Exception("没有找到之前选择的 "+browser+"。请打开安装扩展.exe，重新选择已安装的浏览器。");Process.Start(new ProcessStartInfo(exe,url){UseShellExecute=true});}
}

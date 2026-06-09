# Word 剧本转 Excel 配表工具

一个本地单机 WebUI 工具，用来把 `.docx` 剧本文档按段落逐行转换为 Excel 配表。

## 功能

- 上传单个 `.docx` 剧本文件
- 每个非空 Word 段落导出为 Excel 一行
- 优先识别 `【角色】台词`
- 未识别角色的行自动归为 `旁白`
- 默认导出 `角色`、`台词` 两列
- 可选额外导出 `原文` 列

## 本机运行

```powershell
python -m pip install -r requirements.txt
python app.py
```

也可以直接双击 `start_webui.bat`。

## 打包成独立 exe 发给别人

```powershell
python exe_builder.py
```

或者直接双击 `build_exe_package.bat`。

打包结果会出现在 `dist/word-script-excel-tool.zip`。

把这个 zip 发给别人后，对方只需要：

1. 解压 zip
2. 双击 `run_tool.bat`
3. 脚本会直接启动内置的 `word-script-excel-tool.exe`
4. 浏览器会自动打开工具页面

这个 exe 包不再要求目标电脑安装 Python。

## 测试

```powershell
pytest -q
```

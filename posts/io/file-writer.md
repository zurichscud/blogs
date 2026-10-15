---
title: Java FileWriter 使用指南
lede: java.io.FileWriter —— 以字符流方式写入文本文件
tags: [Java, IO, 字符流]
---

## 1. 概述

`FileWriter` 是 Java IO 包中用于写入**字符文件**的便捷类。它把字符按指定（或默认）字符集编码成字节，再写入文件，适合生成 `.txt`、`.csv`、`.log` 等文本文件。

- 面向**字符**（`char` / `String`），而不是字节（`byte`）
- 默认**覆盖**原文件，可通过 `append` 参数改为**追加**
- 内部编码器带有少量缓冲，写完要 `flush()` 或 `close()` 才能保证内容落盘
- 文件不存在时会自动创建，但**不会创建父目录**
- 写入二进制数据（图片、视频等）应该用 `FileOutputStream`

## 2. 类继承结构

```
java.lang.Object
  └─ java.io.Writer
      └─ java.io.OutputStreamWriter
          └─ java.io.FileWriter
```

实现的接口：`Closeable`、`AutoCloseable`、`Flushable`、`Appendable`。所以它可以用在 try-with-resources 中，也支持链式 `append()`。

## 3. 构造方法

| 构造方法                                                       | 说明                                     | 版本 |
| -------------------------------------------------------------- | ---------------------------------------- | ---- |
| `FileWriter(String fileName)`                                  | 根据文件路径创建，覆盖写，使用默认字符集 | 1.1  |
| `FileWriter(String fileName, boolean append)`                  | 根据路径创建，`true` 表示追加写          | 1.1  |
| `FileWriter(File file)`                                        | 根据 File 对象创建，覆盖写               | 1.1  |
| `FileWriter(File file, boolean append)`                        | 根据 File 对象创建，可选追加写           | 1.4  |
| `FileWriter(FileDescriptor fd)`                                | 根据文件描述符创建                       | 1.1  |
| `FileWriter(String fileName, Charset charset)`                 | 根据路径创建，并指定字符集               | 11   |
| `FileWriter(String fileName, Charset charset, boolean append)` | 指定字符集，可选追加写                   | 11   |
| `FileWriter(File file, Charset charset)`                       | 根据 File 对象创建，并指定字符集         | 11   |
| `FileWriter(File file, Charset charset, boolean append)`       | 指定字符集，可选追加写                   | 11   |

> 如果路径是一个目录、文件无法创建，或父目录不存在，构造方法会抛出 `IOException`（实际是 `FileNotFoundException`）。

## 4. 常用方法

FileWriter 本身没有新增方法，下面这些都继承自 `OutputStreamWriter` 和 `Writer`：

| 方法                                           | 返回值   | 说明                                   |
| ---------------------------------------------- | -------- | -------------------------------------- |
| `write(int c)`                                 | `void`   | 写入单个字符（取 int 的低 16 位）      |
| `write(char[] cbuf)`                           | `void`   | 写入整个字符数组                       |
| `write(char[] cbuf, int off, int len)`         | `void`   | 从数组的 off 位置开始，写入 len 个字符 |
| `write(String str)`                            | `void`   | 写入字符串                             |
| `write(String str, int off, int len)`          | `void`   | 写入字符串的一部分                     |
| `append(CharSequence csq)`                     | `Writer` | 追加字符序列，返回自身，可链式调用     |
| `append(char c)`                               | `Writer` | 追加单个字符                           |
| `append(CharSequence csq, int start, int end)` | `Writer` | 追加字符序列的 [start, end) 部分       |
| `flush()`                                      | `void`   | 把缓冲区内容强制写入文件               |
| `getEncoding()`                                | `String` | 返回当前使用的字符编码名称             |
| `close()`                                      | `void`   | 先 flush，再关闭流并释放资源           |

> 注意：`write()` 不会自动换行。换行需要手动写 `"\n"`、`System.lineSeparator()`，或配合 `BufferedWriter.newLine()` / `PrintWriter.println()`。

## 5. 代码示例

### 5.1 写入字符串（覆盖）

```java
import java.io.FileWriter;
import java.io.IOException;

public class WriteDemo {
    public static void main(String[] args) {
        try (FileWriter writer = new FileWriter("demo.txt")) {
            writer.write("Hello, FileWriter!\n");
            writer.write("第二行内容\n");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

> 每次运行都会清空 `demo.txt` 原有内容，再重新写入。

### 5.2 追加写入

```java
try (FileWriter writer = new FileWriter("app.log", true)) {   // true = 追加
    writer.append("[INFO] ")
          .append("程序启动")
          .append(System.lineSeparator());
} catch (IOException e) {
    e.printStackTrace();
}
```

### 5.3 配合 BufferedWriter 按行写入（推荐）

```java
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.List;

List<String> lines = List.of("张三,18", "李四,20", "王五,22");

try (BufferedWriter bw = new BufferedWriter(
        new FileWriter("users.csv", StandardCharsets.UTF_8))) {
    bw.write("name,age");
    bw.newLine();
    for (String line : lines) {
        bw.write(line);
        bw.newLine();          // 使用平台相关的换行符
    }
} catch (IOException e) {
    e.printStackTrace();
}
```

## 6. 缓冲与 flush

FileWriter 内部的编码器会先把字符攒在缓冲区里，**不是每次 `write()` 都立即写到磁盘**。

- 忘记 `close()` / `flush()`：程序结束时文件可能是空的，或者少了最后一部分内容。
- try-with-resources 会自动调用 `close()`，`close()` 内部会先 `flush()`。
- 需要实时写出（比如日志）时，可以在关键位置手动调用 `flush()`，但不要每写一个字符就 flush，否则性能很差。

```java
FileWriter writer = new FileWriter("demo.txt");
writer.write("abc");
// 此时 demo.txt 可能仍然是空的
writer.flush();   // 现在内容写入了
writer.close();
```

## 7. 字符编码问题

和 FileReader 一样，FileWriter 最容易出问题的地方也是**字符编码**。

- **Java 17 及以前**：默认字符集由操作系统决定。中文 Windows 上通常是 GBK，Linux/macOS 上通常是 UTF-8。在 Windows 上写出的文件拿到 Linux 上读，可能出现乱码。
- **Java 18 及以后**（JEP 400）：默认字符集统一为 UTF-8。
- **Java 11 以前**：FileWriter 不能指定编码，需要改用 `OutputStreamWriter`。

```java
// Java 11+：直接指定编码
new FileWriter("gbk.txt", Charset.forName("GBK"));

// Java 8 及以前：使用 OutputStreamWriter
new OutputStreamWriter(new FileOutputStream("gbk.txt"), "GBK");

// 追加 + 指定编码（Java 8）
new OutputStreamWriter(new FileOutputStream("gbk.txt", true), "GBK");
```

> 建议：**始终显式指定字符集**，比如 `StandardCharsets.UTF_8`，并且读写两端使用同一种编码。

## 8. 与其他写入方式对比

| 方式                            | 特点                                | 适用场景                 |
| ------------------------------- | ----------------------------------- | ------------------------ |
| `FileWriter`                    | 字符流，缓冲很少                    | 简单写入，一般作为底层流 |
| `BufferedWriter + FileWriter`   | 有缓冲，支持 `newLine()`            | 大量文本、按行写入       |
| `PrintWriter`                   | 支持 `println()`、`printf()`        | 格式化输出、报表         |
| `OutputStreamWriter`            | 可以指定编码，适用于任意字节流      | Java 8 指定编码、网络流  |
| `Files.newBufferedWriter(path)` | NIO，默认 UTF-8，可设置打开选项     | 现代代码推荐             |
| `Files.writeString(path, str)`  | 一行代码写完整字符串（Java 11+）    | 小文件                   |
| `Files.write(path, lines)`      | 一次写入 List<String>，每行自动换行 | 中小文件                 |
| `FileOutputStream`              | 字节流                              | 二进制文件               |

```java
// NIO 写法（Java 11+）
Files.writeString(Path.of("demo.txt"), "Hello NIO");

// 追加写
Files.writeString(Path.of("app.log"), "新的一行\n",
        StandardOpenOption.CREATE, StandardOpenOption.APPEND);

try (BufferedWriter bw = Files.newBufferedWriter(Path.of("out.txt"))) {
    bw.write("默认就是 UTF-8");
}
```

## 9. 最佳实践

1. **使用 try-with-resources**，确保流一定会关闭，内容一定会 flush。
2. **显式指定字符集**，避免跨平台乱码，读写两端保持一致。
3. **套上 BufferedWriter**，减少系统调用，提升性能。
4. **分清覆盖和追加**：默认会清空原文件，需要保留旧内容时记得传 `append = true`。
5. **先创建父目录**，FileWriter 不会帮你建目录。
6. **换行用 `newLine()` 或 `System.lineSeparator()`**，不要硬编码 `\r\n`。
7. **二进制数据不要用 FileWriter**，否则会被错误编码而损坏。
8. 新项目优先考虑 **`java.nio.file.Files`** API，写法更简洁，功能更强。

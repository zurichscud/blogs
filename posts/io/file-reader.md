---
title: Java FileReader 使用指南
lede: java.io.FileReader —— 以字符流方式读取文本文件
tags: [Java, IO, 字符流]
---

## 1. 概述

`FileReader` 是 Java IO 包中用于读取**字符文件**的便捷类。它把文件的字节流按指定（或默认）字符集解码成字符，适合读取 `.txt`、`.csv`、`.properties` 等文本文件。

- 面向**字符**（`char`），而不是字节（`byte`）
- 本身没有缓冲，通常要配合 `BufferedReader` 使用
- 读取二进制文件（图片、视频等）应该用 `FileInputStream`

## 2. 类继承结构

```
java.lang.Object
  └─ java.io.Reader
      └─ java.io.InputStreamReader
          └─ java.io.FileReader
```

实现的接口：`Closeable`、`AutoCloseable`、`Readable`。所以它可以用在 try-with-resources 中。

## 3. 构造方法

| 构造方法                                       | 说明                               | 版本 |
| ---------------------------------------------- | ---------------------------------- | ---- |
| `FileReader(String fileName)`                  | 根据文件路径创建，使用默认字符集   | 1.1  |
| `FileReader(File file)`                        | 根据 File 对象创建，使用默认字符集 | 1.1  |
| `FileReader(FileDescriptor fd)`                | 根据文件描述符创建                 | 1.1  |
| `FileReader(String fileName, Charset charset)` | 根据路径创建，并指定字符集         | 11   |
| `FileReader(File file, Charset charset)`       | 根据 File 对象创建，并指定字符集   | 11   |

## 4. 常用方法

FileReader 本身没有新增方法，下面这些都继承自 `InputStreamReader` 和 `Reader`：

| 方法                                  | 返回值    | 说明                                                    |
| ------------------------------------- | --------- | ------------------------------------------------------- |
| `read()`                              | `int`     | 读取单个字符，到达末尾时返回 `-1`                       |
| `read(char[] cbuf)`                   | `int`     | 读入字符数组，返回实际读取的字符数，到达末尾时返回 `-1` |
| `read(char[] cbuf, int off, int len)` | `int`     | 从数组的 off 位置开始，最多读取 len 个字符              |
| `read(CharBuffer target)`             | `int`     | 读入 CharBuffer                                         |
| `skip(long n)`                        | `long`    | 跳过 n 个字符                                           |
| `ready()`                             | `boolean` | 流是否可以读取而不阻塞                                  |
| `getEncoding()`                       | `String`  | 返回当前使用的字符编码名称                              |
| `transferTo(Writer out)`              | `long`    | 把剩余字符全部写入 Writer（Java 10+）                   |
| `markSupported()`                     | `boolean` | 恒为 `false`，不支持 mark/reset                         |
| `close()`                             | `void`    | 关闭流并释放资源                                        |

## 5. 代码示例

### 5.1 逐个字符读取

```java
import java.io.FileReader;
import java.io.IOException;

public class ReadCharDemo {
    public static void main(String[] args) {
        try (FileReader reader = new FileReader("demo.txt")) {
            int ch;
            while ((ch = reader.read()) != -1) {
                System.out.print((char) ch);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

> 每次调用 `read()` 都可能触发一次底层 IO，效率很低。只适合演示或很小的文件。

### 5.2 使用字符数组缓冲读取

```java
try (FileReader reader = new FileReader("demo.txt")) {
    char[] buffer = new char[1024];
    int len;
    while ((len = reader.read(buffer)) != -1) {
        // 注意：只使用 [0, len) 范围内的字符
        System.out.print(new String(buffer, 0, len));
    }
} catch (IOException e) {
    e.printStackTrace();
}
```

### 5.3 配合 BufferedReader 按行读取（推荐）

```java
import java.io.*;
import java.nio.charset.StandardCharsets;

try (BufferedReader br = new BufferedReader(
        new FileReader("demo.txt", StandardCharsets.UTF_8))) {
    String line;
    int lineNo = 1;
    while ((line = br.readLine()) != null) {
        System.out.println(lineNo++ + ": " + line);
    }
} catch (IOException e) {
    e.printStackTrace();
}
```

### 5.4 读取整个文件为字符串

```java
import java.io.*;
import java.nio.charset.StandardCharsets;

public static String readAll(String path) throws IOException {
    try (FileReader reader = new FileReader(path, StandardCharsets.UTF_8);
         StringWriter writer = new StringWriter()) {
        reader.transferTo(writer);   // Java 10+
        return writer.toString();
    }
}
```

## 6. 字符编码问题

FileReader 最容易出问题的地方是**字符编码**。

- **Java 17 及以前**：默认字符集由操作系统决定。中文 Windows 上通常是 GBK，Linux/macOS 上通常是 UTF-8。同一份代码换一台机器可能出现乱码。
- **Java 18 及以后**（JEP 400）：默认字符集统一为 UTF-8。
- **Java 11 以前**：FileReader 不能指定编码，需要改用 `InputStreamReader`。

```java
// Java 11+：直接指定编码
new FileReader("gbk.txt", Charset.forName("GBK"));

// Java 8 及以前：使用 InputStreamReader
new InputStreamReader(new FileInputStream("gbk.txt"), "GBK");
```

> 建议：**始终显式指定字符集**，比如 `StandardCharsets.UTF_8`，不要依赖平台默认值。

## 8. 与其他读取方式对比

| 方式                            | 特点                           | 适用场景                 |
| ------------------------------- | ------------------------------ | ------------------------ |
| `FileReader`                    | 字符流，无缓冲                 | 简单读取，一般作为底层流 |
| `BufferedReader + FileReader`   | 有缓冲，支持 `readLine()`      | 按行处理大文件           |
| `InputStreamReader`             | 可以指定编码，适用于任意字节流 | Java 8 指定编码、网络流  |
| `Files.newBufferedReader(path)` | NIO，默认 UTF-8                | 现代代码推荐             |
| `Files.readAllLines(path)`      | 一次读入 List                  | 中小文件                 |
| `Files.readString(path)`        | 一行代码读完整文件（Java 11+） | 小文件                   |
| `Files.lines(path)`             | 返回 Stream，惰性读取          | 流式处理大文件           |
| `FileInputStream`               | 字节流                         | 二进制文件               |

```java
// NIO 写法（Java 11+）
String content = Files.readString(Path.of("demo.txt"));

try (Stream<String> lines = Files.lines(Path.of("demo.txt"))) {
    lines.filter(l -> l.contains("ERROR")).forEach(System.out::println);
}
```

## 9. 最佳实践

1. **使用 try-with-resources**，确保流一定会关闭，避免资源泄漏。
2. **显式指定字符集**，避免跨平台乱码。
3. **套上 BufferedReader**，减少系统调用，提升性能。
4. **使用 `read(char[])` 的返回值**，只处理实际读取到的字符，不要处理整个缓冲区。
5. **二进制文件不要用 FileReader**，否则数据会被错误解码而损坏。
6. 新项目优先考虑 **`java.nio.file.Files`** API，写法更简洁，功能更强。

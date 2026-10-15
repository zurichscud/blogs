---
title: Java FileOutputStream 使用指南
lede: java.io.FileOutputStream —— 以字节流方式写入文件
tags: [Java, IO, 字节流]
---

## 1. 概述

`FileOutputStream` 是 Java IO 包中用于向文件写入**原始字节**的类。它不做任何编码，传进去什么字节就写出什么字节，因此可以写出**任意类型**的文件：图片、音频、压缩包、序列化数据，当然也包括文本文件。

- 面向**字节**（`byte`），而不是字符（`char`）
- 默认**覆盖**原文件，可通过 `append` 参数改为**追加**
- 本身没有缓冲，每次 `write()` 都直接交给操作系统，通常要配合 `BufferedOutputStream` 使用
- 文件不存在时会自动创建，但**不会创建父目录**
- 写文本时需要自己处理编码，推荐套上 `OutputStreamWriter` 或直接用 `FileWriter`

## 2. 类继承结构

```
java.lang.Object
  └─ java.io.OutputStream
      └─ java.io.FileOutputStream
```

实现的接口：`Closeable`、`AutoCloseable`、`Flushable`。所以它可以用在 try-with-resources 中。

> 对比：`FileWriter` 继承自 `Writer`（字符流），`FileOutputStream` 继承自 `OutputStream`（字节流）。`FileWriter` 底层其实就是把字符编码成字节，再交给 `FileOutputStream` 写出。

## 3. 构造方法

| 构造方法                                        | 说明                            | 版本 |
| ----------------------------------------------- | ------------------------------- | ---- |
| `FileOutputStream(String name)`                 | 根据文件路径创建，覆盖写        | 1.0  |
| `FileOutputStream(String name, boolean append)` | 根据路径创建，`true` 表示追加写 | 1.1  |
| `FileOutputStream(File file)`                   | 根据 File 对象创建，覆盖写      | 1.0  |
| `FileOutputStream(File file, boolean append)`   | 根据 File 对象创建，可选追加写  | 1.4  |
| `FileOutputStream(FileDescriptor fd)`           | 根据已打开的文件描述符创建      | 1.0  |

> 和 FileWriter 不同，FileOutputStream **没有 Charset 参数**，因为字节流不涉及编码。
>
> 如果路径是一个目录、文件无法创建，或父目录不存在，构造方法会抛出 `FileNotFoundException`。

## 4. 常用方法

| 方法                                | 返回值           | 说明                                              |
| ----------------------------------- | ---------------- | ------------------------------------------------- |
| `write(int b)`                      | `void`           | 写入一个字节（只取 int 的低 8 位）                |
| `write(byte[] b)`                   | `void`           | 写入整个字节数组                                  |
| `write(byte[] b, int off, int len)` | `void`           | 从数组的 off 位置开始，写入 len 个字节            |
| `flush()`                           | `void`           | 继承自 OutputStream，对 FileOutputStream 是空操作 |
| `getChannel()`                      | `FileChannel`    | 获取对应的 NIO 通道（Java 1.4+）                  |
| `getFD()`                           | `FileDescriptor` | 获取底层文件描述符，可调用 `sync()` 强制落盘      |
| `close()`                           | `void`           | 关闭流并释放资源                                  |

> 注意：`write(int b)` 只写低 8 位。`write(256)` 实际写入的是 `0x00`，`write(-1)` 写入的是 `0xFF`。

## 5. 代码示例

### 5.1 写入字节（覆盖）

```java
import java.io.FileOutputStream;
import java.io.IOException;

public class WriteByteDemo {
    public static void main(String[] args) {
        try (FileOutputStream out = new FileOutputStream("demo.bin")) {
            out.write(0x48);   // 'H'
            out.write(0x69);   // 'i'
            out.write(new byte[]{0x0A});   // 换行
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

> 每次运行都会清空 `demo.bin` 原有内容，再重新写入。

### 5.2 追加写入文本

```java
import java.io.*;
import java.nio.charset.StandardCharsets;

try (FileOutputStream out = new FileOutputStream("app.log", true)) {   // true = 追加
    String msg = "[INFO] 程序启动" + System.lineSeparator();
    out.write(msg.getBytes(StandardCharsets.UTF_8));   // 手动指定编码
} catch (IOException e) {
    e.printStackTrace();
}
```

### 5.3 复制文件（经典写法）

```java
import java.io.*;

try (FileInputStream in = new FileInputStream("photo.jpg");
     FileOutputStream out = new FileOutputStream("photo_copy.jpg")) {
    byte[] buffer = new byte[8192];
    int len;
    while ((len = in.read(buffer)) != -1) {
        out.write(buffer, 0, len);   // 一定要用 len，不能写整个 buffer
    }
} catch (IOException e) {
    e.printStackTrace();
}

// Java 9+ 更简洁：
try (var in = new FileInputStream("photo.jpg");
     var out = new FileOutputStream("photo_copy.jpg")) {
    in.transferTo(out);
}
```

### 5.4 配合 BufferedOutputStream

```java
import java.io.*;

try (BufferedOutputStream bos = new BufferedOutputStream(
        new FileOutputStream("big.dat"))) {
    for (int i = 0; i < 1_000_000; i++) {
        bos.write(i & 0xFF);   // 先写进 8KB 缓冲区，满了才真正写文件
    }
}   // close() 会先 flush 缓冲区
```

### 5.5 写入文本（转成字符流）

```java
import java.io.*;
import java.nio.charset.StandardCharsets;

try (BufferedWriter bw = new BufferedWriter(
        new OutputStreamWriter(new FileOutputStream("users.csv"), StandardCharsets.UTF_8))) {
    bw.write("name,age");
    bw.newLine();
    bw.write("张三,18");
    bw.newLine();
}
```

## 6. 缓冲、flush 与落盘

FileOutputStream 自己**没有缓冲区**，所以它的 `flush()` 什么也不做。但这里有三层，要分清楚：

1. **Java 层缓冲**：只有套了 `BufferedOutputStream`、`OutputStreamWriter` 等包装流时才有。忘记 `flush()` / `close()` 会丢失这部分数据。
2. **操作系统缓存**：`write()` 返回后，数据通常还在系统的页缓存里，并没有真正写到磁盘。
3. **磁盘**：断电或系统崩溃时，只有真正落盘的数据才安全。

需要保证数据一定写入磁盘时（比如配置文件、交易记录），可以强制同步：

```java
try (FileOutputStream out = new FileOutputStream("important.dat")) {
    out.write(data);
    out.getFD().sync();            // 强制把系统缓存写入磁盘
    // 或者：out.getChannel().force(true);
}
```

> `sync()` 很慢，只在确实需要可靠持久化时使用，不要在循环里频繁调用。

## 7. 字节流与文本

FileOutputStream 只认字节，要写文字就必须先**编码**，而编码就涉及字符集。

- `str.getBytes()` 不带参数时使用平台默认字符集：Java 17 及以前在中文 Windows 上通常是 GBK，Java 18 及以后（JEP 400）统一为 UTF-8。
- 读写两端编码不一致就会乱码，比如用 GBK 写、用 UTF-8 读。
- Java 8 及以前想让 FileWriter 指定编码，标准写法就是用 `OutputStreamWriter` 包一层 FileOutputStream：

```java
// 指定编码写文本
new OutputStreamWriter(new FileOutputStream("gbk.txt"), "GBK");

// 追加 + 指定编码
new OutputStreamWriter(new FileOutputStream("gbk.txt", true), "GBK");

// 直接写字节时也要指定编码
out.write("你好".getBytes(StandardCharsets.UTF_8));
```

> 建议：**写二进制用 FileOutputStream，写文本用字符流**（`FileWriter` / `OutputStreamWriter` / `Files.newBufferedWriter`），并始终显式指定字符集。

## 8. 与其他写入方式对比

| 方式                                      | 特点                                | 适用场景                   |
| ----------------------------------------- | ----------------------------------- | -------------------------- |
| `FileOutputStream`                        | 字节流，无缓冲                      | 二进制文件，一般作为底层流 |
| `BufferedOutputStream + FileOutputStream` | 有缓冲，减少系统调用                | 频繁小块写入               |
| `DataOutputStream`                        | 按 int、long、double 等基本类型写出 | 自定义二进制格式           |
| `ObjectOutputStream`                      | 写出序列化对象                      | Java 对象持久化            |
| `PrintStream`                             | 支持 `println()`、`printf()`        | 日志、控制台式输出         |
| `FileWriter`                              | 字符流，自动编码                    | 文本文件                   |
| `RandomAccessFile`                        | 可随机定位读写                      | 大文件局部修改             |
| `Files.write(path, bytes)`                | 一次写出 byte[]                     | 中小文件                   |
| `Files.newOutputStream(path)`             | NIO，可设置打开选项                 | 现代代码推荐               |
| `FileChannel`                             | NIO 通道，支持内存映射、零拷贝      | 大文件、高性能场景         |

```java
// NIO 写法（Java 7+）
Files.write(Path.of("photo_copy.jpg"), bytes);

// 追加写
Files.write(Path.of("app.log"), "新的一行\n".getBytes(StandardCharsets.UTF_8),
        StandardOpenOption.CREATE, StandardOpenOption.APPEND);

try (OutputStream out = Files.newOutputStream(Path.of("out.bin"))) {
    // 和 FileOutputStream 用法一样
}
```

## 9. 最佳实践

1. **使用 try-with-resources**，确保流一定会关闭，避免文件句柄泄漏。
2. **分清覆盖和追加**：默认会清空原文件，需要保留旧内容时记得传 `append = true`。
3. **套上 BufferedOutputStream**，不要逐字节写大量数据。
4. **使用 `write(buffer, 0, len)`**，复制数据时只写实际读到的部分。
5. **先创建父目录**，FileOutputStream 不会帮你建目录。
6. **写文本时显式指定字符集**，`getBytes(StandardCharsets.UTF_8)` 或改用字符流。
7. **重要数据用 `getFD().sync()` 强制落盘**，但不要频繁调用。
8. 新项目优先考虑 **`java.nio.file.Files`** API，写入、复制都更简洁。

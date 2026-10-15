---
title: Java FileInputStream 使用指南
lede: java.io.FileInputStream —— 以字节流方式读取文件
tags: [Java, IO, 字节流]
---

## 1. 概述

`FileInputStream` 是 Java IO 包中用于从文件读取**原始字节**的类。它不做任何解码，读到什么字节就返回什么字节，因此可以读取**任意类型**的文件：图片、音频、视频、压缩包、`.class` 文件，当然也包括文本文件。

- 面向**字节**（`byte`），而不是字符（`char`）
- 本身没有缓冲，通常要配合 `BufferedInputStream` 或自定义 `byte[]` 缓冲区使用
- 读取文本时需要自己处理编码，推荐套上 `InputStreamReader` 或直接用 `FileReader`
- 文件不存在、是目录或没有读权限时，构造方法会抛出 `FileNotFoundException`

## 2. 类继承结构

```
java.lang.Object
  └─ java.io.InputStream
      └─ java.io.FileInputStream
```

实现的接口：`Closeable`、`AutoCloseable`。所以它可以用在 try-with-resources 中。

> 对比：`FileReader` 继承自 `Reader`（字符流），`FileInputStream` 继承自 `InputStream`（字节流）。`FileReader` 底层其实就是用 `FileInputStream` 读字节再解码。

## 3. 构造方法

| 构造方法                            | 说明                                   | 版本 |
| ----------------------------------- | -------------------------------------- | ---- |
| `FileInputStream(String name)`      | 根据文件路径创建                       | 1.0  |
| `FileInputStream(File file)`        | 根据 File 对象创建                     | 1.0  |
| `FileInputStream(FileDescriptor fd)`| 根据已打开的文件描述符创建             | 1.0  |

> 和 FileReader 不同，FileInputStream **没有 Charset 参数**，因为字节流根本不涉及编码。

## 4. 常用方法

| 方法                                       | 返回值        | 说明                                                       |
| ------------------------------------------ | ------------- | ---------------------------------------------------------- |
| `read()`                                   | `int`         | 读取一个字节（0~255），到达末尾时返回 `-1`                 |
| `read(byte[] b)`                           | `int`         | 读入字节数组，返回实际读取的字节数，到达末尾时返回 `-1`    |
| `read(byte[] b, int off, int len)`         | `int`         | 从数组的 off 位置开始，最多读取 len 个字节                 |
| `readAllBytes()`                           | `byte[]`      | 读取剩余全部字节（Java 9+）                                |
| `readNBytes(int len)`                      | `byte[]`      | 最多读取 len 个字节（Java 11+）                            |
| `readNBytes(byte[] b, int off, int len)`   | `int`         | 读满 len 个字节或到达末尾才返回（Java 9+）                 |
| `skip(long n)`                             | `long`        | 跳过 n 个字节，返回实际跳过的数量                          |
| `skipNBytes(long n)`                       | `void`        | 精确跳过 n 个字节，不够时抛 `EOFException`（Java 12+）     |
| `available()`                              | `int`         | 估计不阻塞时还能读取的字节数                               |
| `transferTo(OutputStream out)`             | `long`        | 把剩余字节全部写入输出流（Java 9+）                        |
| `getChannel()`                             | `FileChannel` | 获取对应的 NIO 通道（Java 1.4+）                           |
| `getFD()`                                  | `FileDescriptor` | 获取底层文件描述符                                      |
| `markSupported()`                          | `boolean`     | 恒为 `false`，不支持 mark/reset                            |
| `close()`                                  | `void`        | 关闭流并释放资源                                           |

> 注意：`read()` 返回的是 `int` 而不是 `byte`。这样 `-1` 才能表示“文件结束”，而字节 `0xFF` 会返回 `255`，不会和 `-1` 混淆。

## 5. 代码示例

### 5.1 逐个字节读取

```java
import java.io.FileInputStream;
import java.io.IOException;

public class ReadByteDemo {
    public static void main(String[] args) {
        try (FileInputStream in = new FileInputStream("demo.bin")) {
            int b;
            while ((b = in.read()) != -1) {
                System.out.printf("%02X ", b);   // 以十六进制打印
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

> 每次调用 `read()` 都可能触发一次系统调用，效率很低。只适合演示或很小的文件。

### 5.2 使用字节数组缓冲读取

```java
try (FileInputStream in = new FileInputStream("demo.bin")) {
    byte[] buffer = new byte[8192];
    int len;
    long total = 0;
    while ((len = in.read(buffer)) != -1) {
        // 注意：只使用 [0, len) 范围内的字节
        total += len;
    }
    System.out.println("文件大小：" + total + " 字节");
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

### 5.4 配合 BufferedInputStream

```java
import java.io.*;

try (BufferedInputStream bis = new BufferedInputStream(
        new FileInputStream("big.dat"))) {
    int b;
    while ((b = bis.read()) != -1) {
        // 逐字节处理，但实际 IO 由 8KB 缓冲区批量完成
    }
} catch (IOException e) {
    e.printStackTrace();
}
```

### 5.5 读取整个文件为字节数组 / 字符串

```java
import java.io.*;
import java.nio.charset.StandardCharsets;

try (FileInputStream in = new FileInputStream("demo.txt")) {
    byte[] data = in.readAllBytes();                       // Java 9+
    String text = new String(data, StandardCharsets.UTF_8); // 手动指定编码解码
    System.out.println(text);
}
```

### 5.6 按行读取文本（转成字符流）

```java
import java.io.*;
import java.nio.charset.StandardCharsets;

try (BufferedReader br = new BufferedReader(
        new InputStreamReader(new FileInputStream("demo.txt"), StandardCharsets.UTF_8))) {
    String line;
    while ((line = br.readLine()) != null) {
        System.out.println(line);
    }
}
```

## 6. 字节流与文本

FileInputStream 读到的是字节，要变成文字就必须**解码**，而解码就涉及字符集。

- 直接 `(char) in.read()` 只对 ASCII 有效。一个中文字符在 UTF-8 下占 3 个字节、在 GBK 下占 2 个字节，逐字节强转一定乱码。
- 用 `new String(bytes, 0, len, charset)` 解码缓冲区时，缓冲区的边界可能刚好**切断一个多字节字符**，导致个别字符乱码。读文本请优先使用 `InputStreamReader`，它会正确处理跨边界的字符。
- `InputStreamReader` 可以指定任意编码，Java 8 及以前读取 GBK 文件的标准写法就是它：

```java
new InputStreamReader(new FileInputStream("gbk.txt"), "GBK");
```

> 建议：**读二进制用 FileInputStream，读文本用字符流**（`FileReader` / `InputStreamReader` / `Files.newBufferedReader`），并始终显式指定字符集。

## 7. available() 的误区

`available()` 只是“当前不阻塞能读多少”的**估计值**，不保证等于文件剩余大小。

```java
// ❌ 不推荐：对网络流、管道、特殊文件可能不准确
byte[] data = new byte[in.available()];
in.read(data);   // 而且 read 也不保证一次读满

// ✅ 推荐
byte[] data = in.readAllBytes();               // Java 9+
// 或者获取文件大小
long size = new File("demo.bin").length();
long size2 = Files.size(Path.of("demo.bin"));
```

## 8. 与其他读取方式对比

| 方式                                   | 特点                                | 适用场景                   |
| -------------------------------------- | ----------------------------------- | -------------------------- |
| `FileInputStream`                      | 字节流，无缓冲                      | 二进制文件，一般作为底层流 |
| `BufferedInputStream + FileInputStream`| 有缓冲，减少系统调用                | 频繁小块读取               |
| `DataInputStream`                      | 按 int、long、double 等基本类型读取 | 自定义二进制格式           |
| `FileReader`                           | 字符流，自动解码                    | 文本文件                   |
| `InputStreamReader`                    | 字节转字符，可指定编码              | 字节流里的文本             |
| `RandomAccessFile`                     | 可随机定位读写                      | 大文件局部读写             |
| `Files.readAllBytes(path)`             | 一次读入 byte[]                     | 中小文件                   |
| `Files.newInputStream(path)`           | NIO，可设置打开选项                 | 现代代码推荐               |
| `FileChannel`                          | NIO 通道，支持内存映射、零拷贝      | 大文件、高性能场景         |

```java
// NIO 写法（Java 7+）
byte[] data = Files.readAllBytes(Path.of("photo.jpg"));

try (InputStream in = Files.newInputStream(Path.of("photo.jpg"))) {
    // 和 FileInputStream 用法一样
}

// 复制文件一行搞定
Files.copy(Path.of("photo.jpg"), Path.of("photo_copy.jpg"),
        StandardCopyOption.REPLACE_EXISTING);
```

## 9. 最佳实践

1. **使用 try-with-resources**，确保流一定会关闭，避免文件句柄泄漏。
2. **用 `byte[]` 缓冲区或 BufferedInputStream**，不要逐字节读取大文件，缓冲区常用 8KB。
3. **使用 `read(byte[])` 的返回值**，只处理实际读到的 `[0, len)` 部分。
4. **不要依赖 `available()` 判断文件大小**，用 `readAllBytes()` 或 `Files.size()`。
5. **读文本时转成字符流**，并显式指定字符集，不要手动 `(char)` 强转。
6. **超大文件不要 `readAllBytes()`**，会占满内存甚至 `OutOfMemoryError`，应分块读取。
7. 新项目优先考虑 **`java.nio.file.Files`** API，复制、读取都更简洁。

# java.io.FileReader 技术文档

> **Java I/O · 字符流** · 按**字符**读文本文件的便捷类，用对编码才不会乱码。

`java.io.FileReader` 是面向字符的文件读取流：底层用 `FileInputStream` 读字节，再按字符集解码成 `char`。读 `.txt / .csv / .java / .log / .properties` 用它；读图片、视频、zip 等二进制必须用字节流。

## 01 概述与继承体系

FileReader 在 Java I/O 体系中的位置

```text
java.lang.Object  →  java.io.Reader  →  InputStreamReader  →  FileReader
```

**`FileReader = FileInputStream + CharsetDecoder`**。它自己几乎没有新增逻辑，只是把「打开文件字节流 + 绑定字符集」这两步打包成一个构造方法，真正解码工作在父类 `InputStreamReader` 里完成。

> ℹ️ **什么时候用 FileReader？**
> 只读**文本文件**且逻辑简单时。需要指定编码（Java 11 前）、需要缓冲、需要按行读、读大文件——请看第 09 节选更合适的类。

---

## 02 构造方法

**5 个构造 · JDK 11 新增 `Charset` 参数是分水岭**

| 构造签名                                       | 引入        | 说明                                                                    |
| :--------------------------------------------- | :---------- | :---------------------------------------------------------------------- |
| `FileReader(String fileName)`                  | JDK 1.1     | 按路径名打开，字符集 = 默认字符集。文件不存在抛 `FileNotFoundException` |
| `FileReader(File file)`                        | JDK 1.1     | 同上，参数为 `File` 对象                                                |
| `FileReader(FileDescriptor fd)`                | JDK 1.1     | 绑定已打开的文件描述符（如 `FileDescriptor.in`），极少用                |
| `FileReader(File file, Charset charset)`       | **JDK 11+** | 可显式指定编码，**推荐**。例 `StandardCharsets.UTF_8`                   |
| `FileReader(String fileName, Charset charset)` | **JDK 11+** | 同上，路径 + 编码版本                                                   |

```java
// Ctor.java

// JDK 11+：显式编码（推荐）
try (FileReader fr = new FileReader("a.txt", StandardCharsets.UTF_8)) { ... }

// JDK 8：FileReader 定死默认编码，想指定只能用父类
try (InputStreamReader isr = new InputStreamReader(
        new FileInputStream("a.txt"), "GBK")) { ... }

// 现代替代：NIO，一行指定编码
try (BufferedReader br = Files.newBufferedReader(
        Path.of("a.txt"), StandardCharsets.UTF_8)) { ... }
```

> ⚠️ JDK 8 的 `FileReader` **没有**编码参数，只能用平台默认字符集（Windows 中文系统是 GBK，Linux/macOS 是 UTF-8）。同一份代码换机器就乱码——这是 FileReader 被诟病最多的设计缺陷，JDK 11 才补上。

---

## 03 方法详解

**全部继承自 Reader / InputStreamReader · FileReader 自身无新增方法**

| 方法签名                                  | 返回                            | 说明                                                            |
| :---------------------------------------- | :------------------------------ | :-------------------------------------------------------------- |
| `int read()`                              | 单个字符的 int；`-1` = 到文件尾 | 逐字符读。返回的是 char 值（0~65535），不是 byte；**必须判 -1** |
| `int read(char[] cbuf)`                   | 实际读入的字符数；`-1` = 到尾   | 批量读，尽量填满数组。返回值可能 < 数组长度                     |
| `int read(char[] cbuf, int off, int len)` | 实际读入数；`-1` = 到尾         | 最常用底层循环：指定偏移与长度                                  |
| `int read(CharBuffer target)`             | 追加的字符数；`-1` = 到尾       | 继承自 `Reader`，NIO 风格                                       |
| `boolean ready()`                         | 是否可读而不阻塞                | 文件流一般 `true`；到尾或关闭后 `false`。**不可替代 -1 判断**   |
| `void close()`                            | —                               | 关闭并释放文件句柄。**必须调**（优先 try-with-resources）       |
| `String getEncoding()`                    | 编码名                          | 继承自 `InputStreamReader`，返回实际使用的字符集名              |

- **没有 readLine()：** 按行读是 `BufferedReader` 的能力，记得用 `new BufferedReader(new FileReader(...))` 包一层。
- **mark / reset 不可用：** `markSupported()` 返回 `false`，调用 `mark()` 抛 `IOException`。需要回退请用 `BufferedReader`（它支持 mark）。
- **skip(long n)：** 跳过 n 个字符，返回实际跳过的字符数。

```java
// ReadLoop.java — 标准读法

// ① 逐字符（教学用，大文件勿用）
try (FileReader fr = new FileReader("a.txt", StandardCharsets.UTF_8)) {
    int ch;
    while ((ch = fr.read()) != -1) {
        System.out.print((char) ch);
    }
}

// ② 数组批量（推荐底层循环）
try (FileReader fr = new FileReader("a.txt", StandardCharsets.UTF_8)) {
    char[] buf = new char[8192];
    int n;
    StringBuilder sb = new StringBuilder();
    while ((n = fr.read(buf)) != -1) {
        sb.append(buf, 0, n); // 注意：只 append 本次读到的 n 个！
    }
}
```

---

## 04 字符编码 · 核心坑

**90% 的 FileReader 问题都是编码问题 · JEP 400 改变了默认值**

| JDK 版本               | 默认字符集 `file.encoding`                                     | 影响                                    |
| :--------------------- | :------------------------------------------------------------- | :-------------------------------------- |
| JDK 8 ~ 17             | 跟操作系统 Locale：Windows 中文 = `GBK`，Linux/macOS = `UTF-8` | 同代码跨机器行为不一致，乱码重灾区      |
| **JDK 18+（JEP 400）** | 统一 `UTF-8`，除非 `-Dfile.encoding=COMPAT`                    | 可预测，但读老 GBK 文件仍需显式指定 GBK |

> ⛔ **乱码公式：** 文件存的是 GBK 字节，你按 UTF-8 解码 → 中文变 `���`。反之亦然。解码字符集必须与文件**保存时**的编码一致，跟代码无关。

```java
// Encoding.java — 三种指定编码的写法

// ✅ JDK 11+ FileReader 直接指定
FileReader fr1 = new FileReader("a.txt", Charset.forName("GBK"));

// ✅ 全版本通用：InputStreamReader（JDK 8 唯一正解）
InputStreamReader isr = new InputStreamReader(
    new FileInputStream("a.txt"), StandardCharsets.UTF_8);

// ✅ 现代首选：NIO（自动缓冲 + 编码 + Path）
BufferedReader br = Files.newBufferedReader(Path.of("a.txt"), StandardCharsets.UTF_8);

// 查看当前默认编码 / 运行时实际编码
System.out.println(Charset.defaultCharset()); // JDK18+ → UTF-8
System.out.println(fr1.getEncoding());        // → GBK
```

## 07 实战模式

**四个高频场景的正确写法 · 直接复制可用**

### A · 按行读（最常用，必须包 BufferedReader）

```java
// ByLine.java
try (BufferedReader br = new BufferedReader(
        new FileReader("app.log", StandardCharsets.UTF_8))) {
    String line;
    while ((line = br.readLine()) != null) {
        process(line); // readLine() 会去掉换行符
    }
} catch (IOException e) { throw new UncheckedIOException(e); }
```

### B · 小文件一次性读完（JDK 11+/17 现代写法）

```java
// SmallFile.java

// 推荐：NIO 一行搞定，自带缓冲与编码
String content = Files.readString(Path.of("config.json"), StandardCharsets.UTF_8);
List<String> lines = Files.readAllLines(Path.of("data.csv"), StandardCharsets.UTF_8);

// 流式处理大文本（不一次性进内存）
try (Stream<String> s = Files.lines(Path.of("big.log"), StandardCharsets.UTF_8)) {
    s.filter(l -> l.contains("ERROR")).forEach(System.out::println);
}
```

### C · JDK 8 兼容：GBK 文件正确读法

```java
// Gbk.java

// JDK 8 没有 FileReader(File, Charset)，必须用 InputStreamReader
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(
            new FileInputStream("old.csv"), "GBK"))) {
    // ...
} catch (IOException e) { e.printStackTrace(); }
```

### D · properties / CSV 小工具

```java
// Props.java

// properties（注意：原生 load(InputStream) 按 ISO-8859-1，JDK9+ 可用 load(Reader) 走 UTF-8）
Properties p = new Properties();
try (FileReader fr = new FileReader("app.properties", StandardCharsets.UTF_8)) {
    p.load(fr);
}
```

---

## 09 替代方案对比

**FileReader 不是唯一答案 · 按场景选型**

- **✅ FileReader** —— 读小文本最顺手，JDK 11+ 可指定编码。适合教学、简单配置读取。缺点：无缓冲、无 readLine。
- **BufferedReader + FileReader** —— 生产默认组合：缓冲 + readLine + mark 支持。按行处理日志/CSV 必须它。
- **Files.readString / lines（NIO.2）** —— 现代首选：小文件一行读完，大文件流式处理。JDK 11+ 新代码优先考虑。

| 能力             |  FileReader  | InputStreamReader  | BufferedReader 包装 | Files.readString/lines |     Scanner      |
| :--------------- | :----------: | :----------------: | :-----------------: | :--------------------: | :--------------: |
| 指定编码（JDK8） |      ❌      |         ✅         |     ✅（透传）      |           ✅           |  ✅（构造传参）  |
| 按行 readLine    |      ❌      |         ❌         |         ✅          |     ✅（lines 流）     |  ✅（nextLine）  |
| 缓冲             |      ❌      | ❌（小缓冲解码器） |       ✅ 8KB        |           ✅           |    ✅（但慢）    |
| 读二进制         |      ❌      |         ❌         |         ❌          | ❌（用 readAllBytes）  |        ❌        |
| 适用             | 小文本、教学 |   需编码的 JDK8    |   生产按行/大文件   |    现代小文件/流式     | 算法题分隔符解析 |

> ℹ️ **一句话选型：** JDK 17+ 新代码小文件 → `Files.readString`；大文件按行 → `Files.newBufferedReader / Files.lines`；JDK 8 老项目 → `BufferedReader + InputStreamReader(FileInputStream, 编码)`；只有 `FileReader` 能用时记得自己包缓冲。

---

## 10 FAQ 与速查

```java
// CheatSheet.java — 最小可用模板
import java.io.*;
import java.nio.charset.StandardCharsets;

try (BufferedReader br = new BufferedReader(
        new FileReader("a.txt", StandardCharsets.UTF_8))) {
    String line;
    while ((line = br.readLine()) != null) {
        System.out.println(line);
    }
} catch (IOException e) {
    e.printStackTrace();
}
```

> ℹ️ 写对称类是 `java.io.FileWriter`（同样建议包 `BufferedWriter` 并显式编码）。读写都指定同一编码，乱码消失 90%。

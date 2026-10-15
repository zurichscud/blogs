# java.io.FileReader 技术文档

以字符流方式读取文本文件

## 1 概述

`java.io.FileReader` 是用于读取字符文件的便利类。其底层封装了 `FileInputStream`，通过指定的或平台默认的字符集解码器将原始字节流解码为 Unicode 字符（`char`）。适合读取 `.txt`、`.csv`、`.java`、`.log`、`.properties` 等文本文件；若要处理图片、音视频、压缩包等二进制文件，必须使用字节流（如 `FileInputStream`）。

## 2 继承关系

```text
java.lang.Object
  └─ java.io.Reader (抽象字符流基类)
      └─ java.io.InputStreamReader (字节流向字符流的解码桥梁)
          └─ java.io.FileReader (专用于文件的便捷字符流)
```

实现的接口：Closeable、AutoCloseable、Readable。所以它可以用在 try-with-resources 中。

**`FileReader = FileInputStream + CharsetDecoder`**

`FileReader` 自身几乎没有新增特有业务逻辑，核心能力全部继承自 `InputStreamReader` 与 `Reader`。它的本质是把「创建文件字节输入流（`FileInputStream`）」和「绑定字符解码器（`CharsetDecoder`）」封装到构造方法中，提供开箱即用的文件字符读取体验。

---

## 3 构造方法

**5 个构造重载 · JDK 11 新增 `Charset` 支持是重要里程碑**

| 构造方法签名                                   | 版本        | 说明                                                                         |
| :--------------------------------------------- | :---------- | :--------------------------------------------------------------------------- |
| `FileReader(String fileName)`                  | JDK 1.1     | 传入文件路径；使用平台默认字符集；文件不存在抛出 `FileNotFoundException`     |
| `FileReader(File file)`                        | JDK 1.1     | 传入 `File` 对象；使用平台默认字符集                                         |
| `FileReader(FileDescriptor fd)`                | JDK 1.1     | 绑定已打开的文件描述符（如 `FileDescriptor.in`），通常在底层系统调用场景使用 |
| `FileReader(File file, Charset charset)`       | **JDK 11+** | 显式指定字符编码（**推荐**），如 `StandardCharsets.UTF_8`                    |
| `FileReader(String fileName, Charset charset)` | **JDK 11+** | 传入路径与字符编码（**推荐**）                                               |

```java
// CtorDemo.java

// 1. JDK 11+ 推荐写法：显式指定字符编码
try (FileReader fr = new FileReader("data.txt", StandardCharsets.UTF_8)) {
    // 读取逻辑...
}

// 2. JDK 8 兼容写法：FileReader 不支持指定编码，必须回退至父类 InputStreamReader
try (InputStreamReader isr = new InputStreamReader(
        new FileInputStream("data.txt"), StandardCharsets.UTF_8)) {
    // 读取逻辑...
}

// 3. 现代 Java (NIO.2) 替代推荐：直接获取带缓冲的 Reader
try (BufferedReader br = Files.newBufferedReader(
        Path.of("data.txt"), StandardCharsets.UTF_8)) {
    // 读取逻辑...
}
```

> ⚠️ **历史缺陷提示：**  
> JDK 8 及以前的 `FileReader` **未提供**接受字符编码的构造方法，完全依赖平台默认编码（如 Windows 中文环境下通常为 `GBK`，而 Linux/macOS 下为 `UTF-8`）。这常导致「本地运行正常，部署到服务器乱码」的典型环境一致性问题。JDK 11 正式引入了支持 `Charset` 的构造方法补齐了该短板。

---

## 4 常用方法

`FileReader` 自身未扩展新的公共读取方法，完全继承自 `InputStreamReader` 与 `Reader`。

| 方法签名                                  | 返回值                                | 说明                                                                                                |
| :---------------------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| `int read()`                              | 单个字符对应的值；`-1` 表示流已到末尾 | 读取一个字符。返回值为 `int`（0 ~ 65535），必须先判断是否为 `-1`，再强转为 `char`。                 |
| `int read(char[] cbuf)`                   | 实际读取的字符数；`-1` 表示末尾       | 将字符尽量读入目标数组。返回值可能小于数组长度，必须按实际读取数使用。                              |
| `int read(char[] cbuf, int off, int len)` | 实际读取的字符数；`-1` 表示末尾       | 读取最多 `len` 个字符并存储到从 `off` 开始的数组区间。最常用的底层读取方式。                        |
| `int read(CharBuffer target)`             | 读入的字符数；`-1` 表示末尾           | 将字符序列读入指定的 NIO `CharBuffer`。                                                             |
| `boolean ready()`                         | 流是否就绪（读取不阻塞）              | 对常规本地文件流通常返回 `true`；到达文件末尾或流关闭后返回 `false`。**绝不能替代 `-1` 结束判断**。 |
| `long skip(long n)`                       | 实际跳过的字符数                      | 从流中跳过 `n` 个字符。                                                                             |
| `String getEncoding()`                    | 编码名称（如 UTF8）                   | 继承自 `InputStreamReader`，返回当前解码器使用的规范编码名。                                        |
| `void close()`                            | `void`                                | 关闭流并释放底层系统文件句柄。必须调用，强烈建议使用 try-with-resources。                           |

### 核心特性说明

1. **为什么 `read()` 返回 `int` 而非 `char`？**  
   `char` 是 16 位无符号数（取值范围 `0 ~ 65535`），无法表示表示流结束的特殊标记 `-1`。因此用 32 位的 `int` 承载，以 `-1` 作为 EOF（End-Of-File）标识。
2. **不支持 `readLine()`：**  
   按行读取是行缓冲区类 `BufferedReader` 的专属能力。如需按行读取，需使用 `new BufferedReader(new FileReader(...))` 包装。
3. **不支持 `mark()` / `reset()`：**  
   `markSupported()` 恒返回 `false`，直接调用 `mark()` 或 `reset()` 会抛出 `IOException`。若需要流指针重置或前瞻回溯，需由 `BufferedReader` 包装支持。

### 标准读取循环范式

```java
// ReadLoop.java — 规范读取写法

// 方式一：字符缓冲区批量读取（兼顾性能与内存占用，推荐底层写法）
try (FileReader fr = new FileReader("data.txt", StandardCharsets.UTF_8)) {
    char[] buffer = new char[8192]; // 8KB 字符缓冲区
    int charsRead;
    StringBuilder sb = new StringBuilder();
    while ((charsRead = fr.read(buffer)) != -1) {
        // 关键注意：必须只追加实际读取到的 charsRead 个字符，切勿直接使用 buffer.length
        sb.append(buffer, 0, charsRead);
    }
}

// 方式二：单字符读取（每读一字符触发一次解码检查，低效，仅供原理教学）
try (FileReader fr = new FileReader("data.txt", StandardCharsets.UTF_8)) {
    int ch;
    while ((ch = fr.read()) != -1) {
        System.out.print((char) ch);
    }
}
```

---

## 5 字符编码与乱码陷阱

**文本 I/O 乱码的本质是：保存文件时的字节编码 与 读取文件时的解码字符集 不一致。**

| JDK 版本               | 默认编码机制 (`file.encoding`)           | 跨平台行为与影响                                                                                                     |
| :--------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **JDK 8 ~ 17**         | 遵循宿主操作系统的默认区域配置（Locale） | Windows 中文环境默认 `GBK`；Linux / macOS 默认 `UTF-8`。未指定编码的代码跨系统迁移极易产生乱码。                     |
| **JDK 18+（JEP 400）** | 运行时默认编码统一为 `UTF-8`             | 无论操作系统环境，默认均采用 UTF-8，除非显式指定 `-Dfile.encoding=COMPAT`。但读取传统 GBK 遗留文件仍需显式声明 GBK。 |

```java
// EncodingDemo.java — 各版本指定编码的规范方式

// 1. JDK 11+ 官方推荐：FileReader 构造直接指定
FileReader frUtf8 = new FileReader("utf8.txt", StandardCharsets.UTF_8);
FileReader frGbk = new FileReader("gbk.txt", Charset.forName("GBK"));

// 2. JDK 8 兼容通用写法：InputStreamReader 转换
InputStreamReader isr = new InputStreamReader(
        new FileInputStream("data.csv"), StandardCharsets.UTF_8);

// 3. 现代 NIO 方案：Path + 编码
BufferedReader nioReader = Files.newBufferedReader(
        Path.of("config.json"), StandardCharsets.UTF_8);

// 获取与校验当前环境编码
System.out.println("JVM 默认字符集: " + Charset.defaultCharset());
System.out.println("FileReader 实际解码器: " + frUtf8.getEncoding());
```

---

## 6 代码示例

### 6.1 生产级按行读取

按行读取是最普遍的文本操作场景，结合 `BufferedReader` 不仅提供 `readLine()`，还自带内存缓冲区减少磁盘 I/O 次数。

```java
// ByLineExample.java
Path filePath = Path.of("application.log");

try (BufferedReader reader = new BufferedReader(
        new FileReader(filePath.toFile(), StandardCharsets.UTF_8))) {
    String line;
    while ((line = reader.readLine()) != null) {
        // 注意：readLine() 已自动剥离换行符 (\n 或 \r\n)
        processLine(line);
    }
} catch (IOException e) {
    throw new UncheckedIOException("读取日志文件失败: " + filePath, e);
}
```

### 6.2 小文件便捷读取

JDK 11+ / NIO.2 现代写法

现代 Java 项目若仅需快速加载轻量级配置或全量读取文本，NIO.2 的 `Files` 工具类往往是更简洁且安全的选择。

```java
// SmallFileExample.java
Path configPath = Path.of("config.json");

// 场景 1：一次性读取全部内容为 String（内部自动处理流关闭与缓冲）
String content = Files.readString(configPath, StandardCharsets.UTF_8);

// 场景 2：一次性读取所有行至 List<String>
List<String> allLines = Files.readAllLines(configPath, StandardCharsets.UTF_8);

// 场景 3：惰性流式处理（避免大文件撑爆内存，按需读取过滤）
try (Stream<String> lineStream = Files.lines(Path.of("large-audit.log"), StandardCharsets.UTF_8)) {
    lineStream.filter(line -> line.contains("WARN"))
              .forEach(System.out::println);
}
```

### 6.3 遗留系统 GBK 编码兼容

JDK 8 标准解法

```java
// LegacyGbkExample.java
File legacyFile = new File("legacy_data.csv");

// JDK 8 无法在 FileReader 中传参编码，必须用 InputStreamReader + FileInputStream
try (BufferedReader br = new BufferedReader(
        new InputStreamReader(
            new FileInputStream(legacyFile), "GBK"))) {
    String row;
    while ((row = br.readLine()) != null) {
        parseCsvRow(row);
    }
} catch (IOException e) {
    e.printStackTrace();
}
```

### 6.4 加载 Properties 配置文件

```java
// PropertiesExample.java
Properties props = new Properties();

// 原生 load(InputStream) 规范默认按 ISO-8859-1 读取；
// JDK 9+ 推荐使用 load(Reader) 支持以 UTF-8 编码读取包含中文的配置
try (FileReader fr = new FileReader("application.properties", StandardCharsets.UTF_8)) {
    props.load(fr);
}
```

---

## 7 与其他方式对比

在现代 Java 开发中，`FileReader` 并非唯一选项，应结合版本、文件规模及读取要求进行选型：

| 选型对比维度              |  `FileReader`  |  `InputStreamReader`  | `BufferedReader` (包装)  |  `Files.readString / lines`  |       `Scanner`        |
| :------------------------ | :------------: | :-------------------: | :----------------------: | :--------------------------: | :--------------------: |
| **JDK 8 指定编码**        |  ❌ 仅限默认   |    ✅ 构造参数指定    |     ✅ 取决于内层流      |     ✅ `Files` 显式传参      |    ✅ 构造参数指定     |
| **按行读取 (`readLine`)** |   ❌ 不支持    |       ❌ 不支持       |       ✅ 原生支持        |       ✅ lines 流支持        |    ✅ `nextLine()`     |
| **自带缓冲性能**          |   ❌ 无缓冲    | ❌ 仅底层最小解码缓冲 |   ✅ 默认 8KB 字符缓冲   |     ✅ 内部默认启用缓冲      | ✅ 自带小缓冲 (但较慢) |
| **支持 Mark/Reset**       |   ❌ 不支持    |       ❌ 不支持       |       ✅ 支持回溯        |       — (流或整体加载)       |       ❌ 不支持        |
| **读二进制数据**          |  ❌ (会损毁)   |      ❌ (会损毁)      |       ❌ (会损毁)        |    ❌ (应用 readAllBytes)    |      ❌ (会损毁)       |
| **主要适用场景**          | 教学、微型文件 |   JDK 8 需指定编码    | 生产级按行读、大文件日志 | 现代项目首选 (小文件/函数式) |  算法题多类型标记解析  |

> 💡 **核心选型法则：**
>
> 1. **JDK 11+ 新代码读小文件：** 优先选择 `Files.readString(path, charset)`。
> 2. **按行处理大文本/日志：** 优先选择 `Files.lines(path, charset)` 或 `BufferedReader` 包装。
> 3. **维护 JDK 8 遗留代码：** 统一使用 `BufferedReader + InputStreamReader(new FileInputStream(...), charset)`。
> 4. **单纯使用 `FileReader`：** 仅推荐在简易脚本或明确了解 JDK 11+ 构造传参的前提下使用。

---

## 8 速查

```java
// SafeFileReaderDemo.java
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class SafeFileReaderDemo {
    public static void main(String[] args) {
        // 最佳实践：try-with-resources 自动释放 + 显式 UTF-8 + BufferedReader 缓冲包装
        try (BufferedReader reader = new BufferedReader(
                new FileReader("data.txt", StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println(line);
            }
        } catch (IOException e) {
            System.err.println("文件读取发生异常: " + e.getMessage());
        }
    }
}
```

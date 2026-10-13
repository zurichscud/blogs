---
title: "字节流"
---

## 文件读取

### 一次读取一个字节

它每次读取 **1 个字节**，返回 `int`。当读取到文件末尾时为-1

> 1 个字节（Byte）= 8 位（bit）

```java
FileInputStream in = new FileInputStream("D:/test/a.txt");

int data;

while ((data = in.read()) != -1) {
    System.out.print((char) data);
}

in.close();
```

假设它是普通 ASCII/UTF-8 英文文本，那么文件实际存储的是 **5 个字节**：

```
h    e    l    l    o
72   101  108  108  111   ← 十进制
```

| Unicode 字符范围 | UTF-8 字节数 | 例子          |
| ---------------- | ------------ | ------------- |
| ASCII 字符       | 1            | `A`、`h`、`1` |
| 拉丁扩展等       | 2            | `é`           |
| 大多数中文       | 3            | `你`、`好`    |
| 很多 Emoji       | 4            | `😀`          |

### 一次读取一个字节数组

实际开发一般不会一个字节一个字节读取，而是使用缓冲区：

```java
FileInputStream in = new FileInputStream("D:/test/a.txt");

byte[] buffer = new byte[1024];//一次读取1KB

int len;

while ((len = in.read(buffer)) != -1) {
    System.out.println(new String(buffer, 0, len));
}

in.close();
```

## 文件写入

### 一次写入一个字节

```java
try (FileOutputStream out =
         new FileOutputStream("test.txt")) {

    out.write(65);

}
```

### 一次写入一个字节数组

```java
try (FileOutputStream out =
         new FileOutputStream("test.txt")) {

    byte[] bytes = {65, 66, 67};

    out.write(bytes);

}
```

```java
byte[] bytes = "hello".getBytes();

try (FileOutputStream out =
         new FileOutputStream("test.txt")) {

    out.write(bytes);
}
```

### 追加写入

默认情况下：

```java
new FileOutputStream("test.txt")
```

会覆盖文件。

如果要追加：

```java
try (FileOutputStream out =
         new FileOutputStream("test.txt", true)) {

    out.write("abc".getBytes());

}
```

第二个参数`true`表示追加模式。

## 文件复制

循环读写

```java
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

public class CopyFile {
    public static void main(String[] args) throws IOException {
        FileInputStream fis = new FileInputStream("D:/a.zip");
        FileOutputStream fos = new FileOutputStream("D:/backup/a.zip");

        byte[] buffer = new byte[1024];
        int len;

        while ((len = fis.read(buffer)) != -1) {
            fos.write(buffer, 0, len);
        }

        fos.close();
        fis.close();
    }
}
```

## 文件夹复制

 复制整个文件夹需要**递归遍历目录**。

```java
import java.io.*;

public class CopyDir {

    public static void copy(File src, File dest) throws IOException {

        // 如果是文件
        if (src.isFile()) {

            try (
                FileInputStream fis = new FileInputStream(src);
                FileOutputStream fos = new FileOutputStream(dest)
            ) {
                byte[] buffer = new byte[8192];
                int len;

                while ((len = fis.read(buffer)) != -1) {
                    fos.write(buffer, 0, len);
                }
            }

            return;
        }

        // 如果是目录
        if (!dest.exists()) {
            dest.mkdirs();
        }

        File[] files = src.listFiles();

        if (files != null) {
            for (File file : files) {

                File newDest = new File(dest, file.getName());

                copy(file, newDest);
            }
        }
    }

    public static void main(String[] args) throws IOException {

        File src = new File("D:/source");
        File dest = new File("D:/backup");

        copy(src, dest);
    }
}
```

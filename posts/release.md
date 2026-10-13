---
title: "资源释放"
---

## 传统写法

```java
FileInputStream in = null;

try {
    in = new FileInputStream("D:/test/a.txt");

    int data;
    while ((data = in.read()) != -1) {
        System.out.print((char) data);
    }

} catch (IOException e) {
    e.printStackTrace();

} finally {
    if (in != null) {
        try {
            in.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

`if (in != null)`，`new FileInputStream("D:/test/a.txt")`时就有可能出错，in有空指针风险

`in.close()`，本身也可能抛出 `IOException`。



## try-with-resources

`try-with-resources` 是 Java 7 引入的一项语言特性，旨在自动管理资源（如文件流、数据库连接、网络 Socket 等）的释放。

资源会在 `try` 代码块执行完毕后自动关闭

```java
// try-with-resources 简洁写法
try (FileInputStream fis = new FileInputStream("file.txt")) {
    // 操作资源
} catch (IOException e) {
    e.printStackTrace();
}
```

语法规则与使用要求：

- **资源实现接口**：任何声明在 `try(...)` 中的资源类，必须实现 `java.lang.AutoCloseable` 或 `java.io.Closeable` 接口。

- **多资源管理**：可以在 `try(...)` 中声明多个资源，用分号 `;` 分隔，**释放顺序与声明顺序相反**（后声明的先关闭）。

```java
try (
    FileReader fr = new FileReader("input.txt");
    BufferedReader br = new BufferedReader(fr)
) {
    System.out.println(br.readLine());
} catch (IOException e) {
    e.printStackTrace();
}
```



## JDK9改进

Java 9 之前，资源必须直接在 `try(...)` 中新建声明。Java 9 及以后，如果变量是 `final` 或 **有效 final (effectively final)**，可以直接放入 `try(...)`：

```java
// Java 9+ 语法
BufferedReader br = new BufferedReader(new FileReader("file.txt"));
try (br) {
    System.out.println(br.readLine());
}
```

有效 final：Java 8 引入的概念。**如果一个局部变量在初始化后，其值在作用域内再也没有被修改过，即使没有加 `final` 关键字，编译器也会将其视为 `final`。**



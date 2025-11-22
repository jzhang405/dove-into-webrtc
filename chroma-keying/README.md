# 使用Web技术进行背景扣图

## 运行
```
npm -g install http-serve
http-serve .
```
## 本机浏览器打开
```
http://localhost:8080
```
注意：必须使用localhost，否则可能会导致获取摄像头失败。原因见书中WebRTC安全性的说明。

## 技术实现原理

本项目实现了一个简单的 **色度键（Chroma Key）** 效果，类似于影视制作中的"绿幕"技术，通过Web技术（HTML5 Canvas + WebRTC）实现在浏览器中实时替换视频背景。

### 核心技术知识点

#### 1. 色度键（Chroma Key）技术原理

**概念**：色度键是一种图像合成技术，通过检测图像中特定颜色（通常是绿色或蓝色），将其替换为其他图像内容，广泛应用于影视制作、直播场景等。

**实现思路**：
- 检测像素的RGB值，识别目标颜色范围
- 目标颜色区域用背景图像替换
- 非目标区域保持原样

**本项目实现**：
```javascript
// 检测白色或接近白色的区域（R、G、B都大于150）
if (r > 150 && g > 150 && b > 150) {
    // 替换为背景图像的对应像素
    frame.data[i * 4 + 0] = this.imageFrame.data[i*4 + 0];
    frame.data[i * 4 + 1] = this.imageFrame.data[i*4 + 1];
    frame.data[i * 4 + 2] = this.imageFrame.data[i*4 + 2];
}
```

#### 2. WebRTC API - 摄像头访问

**核心API**：`navigator.mediaDevices.getUserMedia()`

**功能**：请求用户媒体权限，获取摄像头/麦克风流

**本项目代码**：
```javascript
navigator.mediaDevices.getUserMedia({
    video: true,   // 请求视频
    audio: false   // 不需要音频
}).then(stream => {
    // 将获取的流设置为视频源的源对象
    this.video.srcObject = stream;
}).catch(error => {
    console.error(error);
})
```

**安全限制**：
- 必须在HTTPS或localhost环境下使用
- 需要用户明确授权
- 防止恶意网站未经允许访问摄像头

#### 3. Canvas API - 双画布架构

**第一层画布（c1）**：
- 作用：捕获原始视频帧
- 用途：作为图像处理的输入源

**第二层画布（c2）**：
- 作用：输出处理后的图像
- 用途：通过`captureStream()`生成新的媒体流

**代码实现**：
```javascript
// 创建画布
this.c1 = document.createElement('canvas');
this.ctx1 = this.c1.getContext("2d");

this.c2 = document.createElement('canvas');
this.ctx2 = this.c2.getContext("2d");

// 绘制原始帧到第一层画布
this.ctx1.drawImage(this.video, 0, 0, this.width, this.height);
let frame = this.ctx1.getImageData(0, 0, this.width, this.height);

// 处理后绘制到第二层画布
this.ctx2.putImageData(frame, 0, 0);
```

**双画布协同工作机制详解**：

整个图像合成流程是通过以下步骤实现的：

1. **第一步：画布转换为视频流**
```javascript
// 第85-88行：创建媒体流
const stream = this.c2.captureStream();
this.videoCapture.srcObject = stream;
```
这一步是关键：`captureStream()` 将画布转换为实时的媒体流，这个流被设置到 `videoCapture` 元素（第二个视频框）上，第二个视频框显示的就是从 `c2` 画布输出的内容。

2. **第二步：实时处理循环（computeFrame函数）**
```javascript
// 在 c1 上绘制当前视频帧
this.ctx1.drawImage(this.video, 0, 0, this.width, this.height);
let frame = this.ctx1.getImageData(0, 0, this.width, this.height);

// 处理像素（将白色区域替换为背景）
for (let i = 0; i < l; i++) {
  let r = frame.data[i * 4 + 0];
  let g = frame.data[i * 4 + 1];
  let b = frame.data[i * 4 + 2];

  // 检测白色像素
  if ( r > 150 && g > 150 && b > 150) {
    // 替换为背景图像的像素
    frame.data[i * 4 + 0] = this.imageFrame.data[i*4 + 0];
    frame.data[i * 4 + 1] = this.imageFrame.data[i*4 + 1];
    frame.data[i * 4 + 2] = this.imageFrame.data[i*4 + 2];
  }
}

// 将处理后的帧绘制到 c2 上
this.ctx2.putImageData(frame, 0, 0);
```

3. **第三步：图像合成流程图**
```
摄像头视频 → c1画布 → 像素处理 → c2画布 → videoCapture元素显示
  +                                           ↓
背景图像 → 在内存中等待被替换 ←←←←←←←←←←←←←←←←←←←←
```

**最终显示效果**：
- **第一个视频框** (`camera`)：显示原始摄像头画面
- **第二个视频框** (`camera-chroma`)：显示合成后的效果（背景 + 非白色区域的人像）

简单说：**第二个画布是一个"渲染表面"，所有处理后的帧都绘制在这里，然后通过媒体流技术让视频元素可以播放这个画布的内容**。

#### 5. 像素级图像处理

**像素数据结构**：
- 每个像素占用4字节：RGBA（红、绿、蓝、透明度）
- 数据数组：`ImageData.data`是一个Uint8ClampedArray
- 索引计算：`data[i*4]`表示第i个像素的R通道

**RGB颜色模型**：
- 范围：每个通道0-255
- 例如：白色(255,255,255)、黑色(0,0,0)、绿色(0,255,0)

**循环处理所有像素**：
```javascript
// 获取像素总数（总字节数 / 4）
let l = frame.data.length / 4;

// 遍历每个像素
for (let i = 0; i < l; i++) {
    let r = frame.data[i * 4 + 0]; // 红色分量
    let g = frame.data[i * 4 + 1]; // 绿色分量
    let b = frame.data[i * 4 + 2]; // 蓝色分量
}
```

#### 6. MediaStream 和捕获流

**概念**：MediaStream表示媒体流，可以从各种源创建（摄像头、麦克风、屏幕等）

**捕获流方法**：`canvas.captureStream(fps)`
- 参数：帧率（frames per second）
- 返回：MediaStream对象，可赋值给video元素的srcObject

**本项目应用**：
```javascript
// 从第二个画布创建媒体流
const stream = this.c2.captureStream();
// 设置为捕获视频的源对象
this.videoCapture.srcObject = stream;
```

#### 7. 动画循环和性能优化

**定时器选择**：
- `setTimeout()` vs `requestAnimationFrame()`
- 本项目使用setTimeout实现20 FPS（1000ms/50ms）

**代码实现**：
```javascript
timerCallback(){
    if (this.video.paused || this.video.ended) {
        return;
    }
    this.computeFrame();
    setTimeout(() => {
        this.timerCallback();
    }, 50);  // 延迟50ms，约20 FPS
}
```

**性能考虑**：
- 50ms延迟：平衡流畅度和CPU使用率
- 全像素循环：可能成为性能瓶颈
- 优化方向：减少像素处理区域、使用Web Workers

#### 8. 图像加载和处理流程

**异步加载背景图像**：
```javascript
const backgroundImg = new Image();
backgroundImg.src = 'media/beachImg';
backgroundImg.onload = () => {
    // 图像加载完成后开始处理
    this.timerCallback();
}
```

**整体处理流程**：
1. DOM加载完成 → 初始化摄像头
2. 视频播放事件 → 设置画布尺寸
3. 背景图像加载 → 开始处理循环
4. 循环处理每一帧 → 实时替换背景

### 项目架构图

```
摄像头视频流
    ↓
[第一层画布] - 捕获原始帧
    ↓
[像素级处理] - 检测并替换白色像素
    ↓
[第二层画布] - 输出处理结果
    ↓
[捕获流] - 生成新的视频流
    ↓
显示在页面上
```

### 技术拓展

**改进方向**：
1. **智能颜色检测**：使用更复杂的算法（如HSV色彩空间、边缘检测）
2. **性能优化**：减少像素处理区域、使用WebGL加速
3. **交互控制**：添加阈值调节、颜色选择功能
4. **实时特效**：添加滤镜、模糊、边缘柔化

**相关技术**：
- WebGL：GPU加速图像处理
- Web Workers：后台线程处理像素数据
- OffscreenCanvas：离屏渲染优化
- WASM：高性能图像处理算法

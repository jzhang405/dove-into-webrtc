/**
 * ChromaKey 类：实现色度键（绿幕）效果
 * 该类通过将视频中接近白色的区域替换为背景图像，实现类似绿幕的效果
 */
class ChromaKey {
  constructor() {
    // 初始化变量
    this.video = null;          // 原始视频元素
    this.videoCapture = null;   // 处理后的视频元素
    this.c1 = null;             // 第一层画布（用于获取原始视频帧）
    this.c2 = null;             // 第二层画布（用于输出处理后的帧）
    this.ctx1 = null;           // 第一层画布的上下文
    this.ctx2 = null;           // 第二层画布的上下文
    this.width = 0;             // 视频宽度
    this.height = 0;            // 视频高度
    this.imageFrame = null;     // 背景图像的像素数据
  }

  /**
   * 加载并获取背景图像帧
   * 从 'media/beach.jpg' 加载图像，并将其像素数据存储在 this.imageFrame 中
   */
  getImageFrame() {
    // 创建图像对象并设置源路径
    const backgroundImg = new Image();
    backgroundImg.src = 'media/beach.jpg';

    // 当图像加载完成后执行
    backgroundImg.onload = () => {
      // 创建一个临时画布来绘制背景图像
      const imageCanvas = document.createElement('canvas');
      // 设置画布尺寸与视频尺寸匹配
      imageCanvas.width = this.width;
      imageCanvas.height = this.height;

      // 获取画布的 2D 渲染上下文
      const ctx = imageCanvas.getContext('2d');
      // 将背景图像绘制到画布上（缩放至视频尺寸）
      ctx.drawImage(backgroundImg, 0, 0, this.width, this.height);

      // 获取画布的像素数据并存储在 this.imageFrame 中
      // 这些数据将在后续的色度键处理中使用
      this.imageFrame = ctx.getImageData(0, 0, this.width, this.height);

      // 图像加载完成后，开始处理视频帧
      this.timerCallback();
    }
  }

  /**
   * 初始化函数：设置视频流和画布
   * 获取用户摄像头权限，创建画布元素，并设置事件监听器
   */
  doLoad() {
    // 获取 HTML 中的视频元素
    this.video = document.getElementById("camera");          // 原始摄像头视频
    this.videoCapture = document.getElementById("camera-chroma"); // 处理后的视频显示

    // 创建第一个画布：用于捕获视频帧
    this.c1 = document.createElement('canvas');
    this.ctx1 = this.c1.getContext("2d");

    // 创建第二个画布：用于输出处理后的帧
    this.c2 = document.createElement('canvas');
    this.ctx2 = this.c2.getContext("2d");

    // 请求用户摄像头权限，获取视频流
    navigator.mediaDevices.getUserMedia({
      video: true,   // 请求视频
      audio: false   // 不需要音频
    }).then(stream => {
      // 将获取的流设置为视频源的源对象
      this.video.srcObject = stream;
    }).catch(error => {
      // 处理错误（例如用户拒绝权限或没有摄像头）
      console.error(error);
    })

    // 当视频开始播放时触发
    this.video.addEventListener("play", () => {
        // 设置所有画布的尺寸与视频尺寸一致
        this.width = this.c1.width = this.c2.width = this.video.videoWidth;
        this.height = this.c1.height = this.c2.height = this.video.videoHeight;

        // 从第二个画布创建一个媒体流
        const stream = this.c2.captureStream();
        // 将流设置为捕获视频的源对象
        this.videoCapture.srcObject = stream;

        // 加载背景图像并开始处理循环
        this.getImageFrame();
      }, false);

  }

  /**
   * 定时回调函数：递归调用以持续处理视频帧
   * 使用 setTimeout 实现约 20 FPS 的处理速度（1000ms / 50ms = 20）
   */
  timerCallback(){
      // 如果视频已暂停或结束，停止处理
      if (this.video.paused || this.video.ended) {
        return;
      }
      // 处理当前视频帧
      this.computeFrame();
      // 延迟 50ms 后再次调用，形成循环
      setTimeout(() => {
          this.timerCallback();
      }, 50);
  }

  /**
   * 计算并处理单个视频帧：实现色度键效果
   * 检测白色（或接近白色）的像素，并用背景图像的对应像素替换
   */
  computeFrame() {
    // 在第一个画布上绘制当前视频帧
    this.ctx1.drawImage(this.video, 0, 0, this.width, this.height);
    // 获取视频帧的像素数据
    let frame = this.ctx1.getImageData(0, 0, this.width, this.height);
    // 计算像素总数（总字节数 / 4，因为每个像素占 4 字节：RGBA）
    let l = frame.data.length / 4;

    // 遍历所有像素
    for (let i = 0; i < l; i++) {
      // 获取当前像素的 RGB 值
      let r = frame.data[i * 4 + 0]; // 红色分量
      let g = frame.data[i * 4 + 1]; // 绿色分量
      let b = frame.data[i * 4 + 2]; // 蓝色分量

      /**
       * 色度键检测：检测是否为白色或接近白色的区域
       * 条件：R、G、B 三个分量都大于 150（范围 0-255）
       * 这相当于在图像中创建了一个白色/浅色的遮罩区域
       */
      if ( r > 150 && g > 150 && b > 150) {
        // 将当前像素替换为背景图像对应位置的像素
        frame.data[i * 4 + 0] = this.imageFrame.data[i*4 + 0]; // 红色
        frame.data[i * 4 + 1] = this.imageFrame.data[i*4 + 1]; // 绿色
        frame.data[i * 4 + 2] = this.imageFrame.data[i*4 + 2]; // 蓝色
        // Alpha 通道保持不变（默认为 255，不透明）
      }
    }
    // 将处理后的像素数据绘制到第二个画布上
    this.ctx2.putImageData(frame, 0, 0);
  }
}

// 创建 ChromaKey 实例
const chroma = new ChromaKey();
// 当 DOM 加载完成时，初始化色度键处理器
document.addEventListener("DOMContentLoaded", () => {
  chroma.doLoad();
});

# thingsboard-widget

## 部件之间通讯交互示例：send_message.json/receive_message.json
这里使用的TB版本是3.3.3，发送消息：
```js
self.onInit = function() {
    self.ctx.$scope.sendMessage = function() {
        const $injector = self.ctx.$scope.$injector;
        const broadcastService = $injector.get(self.ctx.servicesMap.get('broadcastService'));
        broadcastService.broadcast('SOME_CUSTOM_EVENT', {
            message: 'Hello ThingsBoard'
        });
    }
}

```

接收消息：
```js
self.onInit = function() { 
	const $injector = self.ctx.$scope.$injector;
    const broadcastService = $injector.get(self.ctx.servicesMap.get('broadcastService'));
    broadcastService.on('SOME_CUSTOM_EVENT', (evt, data) => {
        // data 是个数组
        console.log('broadcast message', data);
        self.ctx.$scope.message = data[0].message;
        self.ctx.detectChanges();
    });
} 
```

> 使用broadcastService进行部件之间的通讯是最佳方式，使用全局对象也可以，比如一个部件对self.ctx.userService定义新方法，然后在其他部件进行调用。或者使用window.onmessage和window.postMessage。

参考：https://github.com/thingsboard/thingsboard/issues/976

## 聊天室部件：chatroom.json
用法：仪表板数据源添加任意一设备，遥测名称为“chat”。时间窗口数据聚合功能选“空”，一定！

原理：
* 把聊天记录当作遥测进行发送
```js
self.ctx.http.post(`api/plugins/telemetry/DEVICE/${entityId}/timeseries/ANY`, 
  {
      chat: {
          userId: self.ctx.currentUser.userId,
          nick: self.ctx.currentUser.firstName + self.ctx.currentUser.lastName,
          content: self.ctx.$scope.content
      }
  },
  {
      'headers': {
          'content-type': 'application/json',
          'X-Authorization': 'bearer ' + localStorage.getItem('jwt_token')
      }
  }).subscribe(() => {
      self.ctx.$scope.content = "";
  });
```
* 设置好数据源，面板通过WebSocket自动订阅遥测，我们只需要根据数据做展示

## 白板部件：drawing-board.json
用法：仪表板数据源添加任意一设备，遥测名称为“draw_event”。时间窗口数据聚合功能选“空”，一定！

原理：
* 把绘画动作当作遥测进行发送
* 根据drawingboard提供的各种绘图事件构建遥测（一个json对象）并发送
描点动作遥测：
```js
{
  cmd: {
    name: 'stroke',
    points: self.ctx.$scope.points,
    color: self.ctx.$scope.board.mode === 'pencil' ? self.ctx.$scope.board.color : 'white',
    lineWidth: self.ctx.$scope.board.ctx.lineWidth
  },
  drawId: ++self.ctx.$scope.drawId,
  userId: self.ctx.currentUser.userId,
  session: self.ctx.$scope.session
}

```

填充动作遥测：
```js
{
  cmd: {
    name: 'fill',
    coords: event.coords,
    color: self.ctx.$scope.board.color
  }，
  drawId: ++self.ctx.$scope.drawId,
  userId: self.ctx.currentUser.userId,
  session: self.ctx.$scope.session
}
```

* 遥测带有session属性代表发送方，发送方无需重复动作
* 根据遥测内容调用drawingboard提供的绘图方法
* 可多人同时操作

缺点：
* 只要遇到reset动作，图像被全部清空
* 多人同时操作，撤销动作的效果会不一样，这是因为各人进入的时间不一样，看到的图像不一样，而且最开始的绘制过程因为性能原因没有保存每一步的history，只在最后一步保存history

参考：http://leimi.github.io/drawingboard.js/

## 手绘风格白板Excalidraw部件：excalidraw_embed.json
把强大的excalidraw嵌入到thingsboard面板

参考：
* https://www.npmjs.com/package/@excalidraw/excalidraw
* https://codesandbox.io/s/excalidraw-ehlz3?file=/src/App.js


作者：caowm (remobjects@qq.com)

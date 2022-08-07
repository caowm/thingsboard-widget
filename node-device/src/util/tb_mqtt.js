let mqtt = require('mqtt');

module.exports = class tb_mqtt {
    constructor(deviceId, brokerUrl, token, onConnect, onMessage) {
        this.deviceId = deviceId;
        this.brokerUrl = brokerUrl;
        this.token = token;
        this.onConnect = onConnect;
        this.onMessage = onMessage;
        console.log(this.deviceId, 'is connecting mqtt...');
        this.client = mqtt.connect(this.brokerUrl, {
            username: this.token,
            keepalive: 30,
            clientId: 'gate_' + Math.random().toString(16).substr(2, 8),
            connectTimeout: 8000,
            reconnectPeriod: 10000,
        });
        this.client.on('connect', this._connect.bind(this));
        this.client.on('error', this._error.bind(this));
        this.client.on('message', this._message.bind(this));
    }

    publish(telemetry) {
        this.client.publish('v1/devices/me/telemetry', JSON.stringify(telemetry));
    }

    gateway_publish(telemetry) {
        this.client.publish('v1/gateway/telemetry', JSON.stringify(telemetry));
    }

    subscribe_rpc() {
        this.client.subscribe('v1/devices/me/rpc/request/+');
    }

    rpc_response(topic, msg) {
        const requestId = topic.slice('v1/devices/me/rpc/request/'.length);
        this.client.publish('v1/devices/me/rpc/response/' + requestId, JSON.stringify(msg));
    }

    gateway_subscribe_rpc() {
        this.client.subscribe('v1/gateway/rpc');
    }

    _connect() {
        console.info(`${this.deviceId} mqtt connected.`)
        if (this.onConnect) this.onConnect();
        // 订阅我的设备属性更新
        //this.client.subscribe('v1/devices/me/attributes');
        // 订阅请求我的设备属性
        //this.client.subscribe('v1/devices/me/attributes/response/+');
        // 请求我的设备共享属性。devices属性代表网关管理的终端设备列表
        // this.client.publish('v1/devices/me/attributes/request/1', '{"sharedKeys":"devices,ip"}');
    }

    _error(error) {
        console.info(`${this.deviceId} mqtt error: ${error}.`);
    }

    _message(topic, message) {
        console.info(`${this.deviceId} topic: ${topic}, message: ${message}`);
        if (this.onMessage) {
            this.onMessage(topic, message);
        }
    }
}



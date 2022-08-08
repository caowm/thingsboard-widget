const shell = require('shelljs');
const os = require('os');
const tb_mqtt = require('./util/tb_mqtt');

let commandStatus = [];
let childProcesses = [];

const config = require('../config');
shell.env.cwd = config.shell_device.cwd;

const mqtt_client = new tb_mqtt(config.shell_device.name, config.mqtt_broker, config.shell_device.token,
    onConnect, onMessage);

function onConnect() {
    mqtt_client.subscribe_rpc();
    // Schedules telemetry data upload
    setInterval(publishTelemetry, 1000);
}

function onMessage(topic, message) {
    console.log('request.topic: ' + topic);
    console.log('request.body: ' + message.toString());
    const msg = JSON.parse(message.toString());
    if (msg.method == "sendCommand") {
        if (msg.params && msg.params.command && msg.params.command.startsWith('cwd ')) {
            shell.env.cwd = msg.params.command.substring(4);
            commandStatus.push({
                stdout: shell.env.cwd,
            });
        } else {
            const child = shell.exec(msg.params.command, {
                async: true,
                silent: true,
                cwd: shell.env.cwd
            });
            childProcesses.push(child);
            child.stdout.on('data', function(data) {
                commandStatus.push({
                    stdout: data,
                });
            });
            child.stderr.on('data', function(data) {
                commandStatus.push({
                    stderr: data,
                });
            });
            child.on('exit', (code) => {
                console.log(`Child ${child.pid} with commands: ${msg.params.command} \n  exited with code ${code}`);
                commandStatus.push({
                    exitCode: code,
                });
                const index = childProcesses.indexOf(child);
                if (index > -1) childProcesses.splice(index, 1);
            });
        }
        mqtt_client.rpc_response(topic, {ok: true})
    } else if (msg.method == "getCommandStatus") {
        let status = {
            data: commandStatus,
            done: childProcesses.length == 0,
            cwd: shell.env.cwd
        };
        commandStatus = [];
        mqtt_client.rpc_response(topic, status);
    } else if (msg.method == "getTermInfo") {
        mqtt_client.rpc_response(topic, {
            platform: os.platform() + ' ' + os.type(),
            release: os.release(),
        });
    } else if (msg.method == "terminateCommand") {
        for (let child of childProcesses) {
            console.log('killing', child.pid);
            child.kill();
        }
        childProcesses = [];
        mqtt_client.rpc_response(topic, {ok: true})
    }
}

function publishTelemetry() {
    mqtt_client.publish({
        memusage: memUsage(),
        cpuusage: cpuUsage(),
    });
}

function memUsage() {
    return Number((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1) * 1.0;
}

function cpuUsage() {
    //Grab second Measure
    const endMeasure = cpuAverage();

    //Calculate the difference in idle and total time between the measures
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;

    //Calculate the average percentage CPU usage
    const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
    return percentageCPU;
}

// ref: https://gist.github.com/bag-man/5570809
function cpuAverage() {

    //Initialise sum of idle and time of cores and fetch CPU info
    let totalIdle = 0, totalTick = 0;
    const cpus = os.cpus();

    //Loop through CPU cores
    let i = 0, len = cpus.length;
    for (; i < len; i++) {

        //Select CPU core
        const cpu = cpus[i];

        //Total up the time in the cores tick
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }

        //Total up the idle time of the core
        totalIdle += cpu.times.idle;
    }

    //Return the average Idle and Tick times
    return {idle: totalIdle / cpus.length, total: totalTick / cpus.length};
}

//Grab first CPU Measure
var startMeasure = cpuAverage();

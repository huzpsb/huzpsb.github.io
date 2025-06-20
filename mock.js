function loadScript(url, callback) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;

    script.onload = function () {
        callback();
    };

    script.onerror = function () {
        alert("加载依赖失败，请检查网络连接！");
        window.location.reload();
    };

    document.head.appendChild(script);
}


var wsConn = null;
var connected = false;
var connectionId = null;
var targetWSId = null;

var limitA = 0;
var limitB = 0;


function sendWsMsg(messageObj) {
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    if (!messageObj.hasOwnProperty('type'))
        messageObj.type = "msg";
    console.log(JSON.stringify((messageObj)));
    wsConn.send(JSON.stringify((messageObj)));
}

function connectWs() {
    {
        const floatingImage = document.getElementById("floatingImage");
        if (floatingImage) {
            alert("请直接使用右下角的二维码连接设备！");
            return;
        }
        if (connected) {
            alert("已连接设备，请勿重复连接！");
            return;
        }
    }


    wsConn = new WebSocket("wss://coyote.babyfang.cn/");
    wsConn.onclose = function () {
        const floatingImage = document.getElementById("floatingImage");
        if (floatingImage) {
            floatingImage.remove();
        }
        connected = false;
        alert("连接已断开，请重新连接设备！");
    };

    wsConn.onmessage = function (event) {
        let message = null;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            console.log("收到设备回传:", event.data);
            return;
        }
        console.log("收到中继回传:", message);

        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    connectionId = message.clientId;
                    const connectionUrl = "https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#wss://coyote.babyfang.cn/" + connectionId;
                    const floatingImage = document.createElement("div");
                    floatingImage.id = "floatingImage";
                    floatingImage.style.position = "fixed";
                    floatingImage.style.width = "220px";
                    floatingImage.style.height = "220px";
                    floatingImage.style.bottom = "0";
                    floatingImage.style.right = "0";
                    floatingImage.style.zIndex = "1000";
                    floatingImage.style.backgroundColor = "darkgray";
                    document.body.appendChild(floatingImage);

                    const realImageDiv = document.createElement("div");
                    realImageDiv.style.margin = "10px";
                    realImageDiv.style.width = "200px";
                    realImageDiv.style.height = "200px";
                    floatingImage.appendChild(realImageDiv);


                    new QRCode(realImageDiv, {
                        text: connectionUrl,
                        width: 200,
                        height: 200,
                    });
                } else {
                    connected = true;
                    const floatingImage = document.getElementById("floatingImage");
                    if (floatingImage) {
                        floatingImage.remove();
                    }
                    targetWSId = message.targetId;
                }
                break;
            case 'break':
            case 'error':
                wsConn.close();
                break;
            case 'msg':
                // 定义一个空数组来存储结果
                const result = [];
                if (message.message.includes("strength")) {
                    const numbers = message.message.match(/\d+/g).map(Number);
                    result.push({type: "strength", numbers});

                    console.log("channel-a:", numbers[0]);
                    console.log("channel-b:", numbers[1]);
                    console.log("limit-a:", numbers[2]);
                    limitA = numbers[2];
                    console.log("limit-b:", numbers[3]);
                    limitB = numbers[3];
                }
                break;
            default:
                break;
        }
    };
}

const waveData = {
    "1": `["0A0A0A0A00000000","0A0A0A0A0A0A0A0A","0A0A0A0A14141414","0A0A0A0A1E1E1E1E","0A0A0A0A28282828","0A0A0A0A32323232","0A0A0A0A3C3C3C3C","0A0A0A0A46464646","0A0A0A0A50505050","0A0A0A0A5A5A5A5A","0A0A0A0A64646464"]`,
    "2": `["0A0A0A0A00000000","0D0D0D0D0F0F0F0F","101010101E1E1E1E","1313131332323232","1616161641414141","1A1A1A1A50505050","1D1D1D1D64646464","202020205A5A5A5A","2323232350505050","262626264B4B4B4B","2A2A2A2A41414141"]`,
    "3": `["4A4A4A4A64646464","4545454564646464","4040404064646464","3B3B3B3B64646464","3636363664646464","3232323264646464","2D2D2D2D64646464","2828282864646464","2323232364646464","1E1E1E1E64646464","1A1A1A1A64646464"]`
}

function setStrength(strength, channel) {
    if (!connected) {
        alert("请先连接设备！");
        return;
    }
    sendWsMsg({type: 4, message: `strength-${channel === 'A' ? 1 : 2}+2+${strength}`})
}

function play(waveId, duration, channel) {
    if (!connected) {
        alert("请先连接设备！");
        return;
    }
    const wave = waveData[waveId];
    if (!wave) {
        alert("无效的波形ID！");
        return;
    }
    sendWsMsg({type: "clientMsg", message: `${channel}:${wave}`, time: duration, channel: channel})
}


loadScript("https://cdn.bootcdn.net/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", function () {
    connectWs();
});



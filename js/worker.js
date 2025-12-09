let timerID = null;
let interval = 25; // 25ms 的检查频率，足够应对音乐调度

self.onmessage = function(e) {
    if (e.data === "start") {
        if (timerID) clearInterval(timerID);
        timerID = setInterval(function() {
            postMessage("tick");
        }, interval);
    } else if (e.data === "stop") {
        if (timerID) clearInterval(timerID);
        timerID = null;
    }
};
const workerSource = `
let timerID = null;
const interval = 250;
self.onmessage = function(e) {
  if (e.data === "start") {
    if (timerID) clearInterval(timerID);
    timerID = setInterval(function() { postMessage("tick"); }, interval);
  } else if (e.data === "stop") {
    if (timerID) clearInterval(timerID);
    timerID = null;
  }
};
`;

export function createTimerWorker(): Worker {
  const blob = new Blob([workerSource], { type: 'text/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

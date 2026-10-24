// Turns the TEXT env ("m:ss" or "h:mm:ss") into seconds. Output: output.seconds, output.max
// (= seconds + EXTRA) and output.later (= seconds + LATER).
const parts = TEXT.trim().split(':').map(Number);
let seconds = 0;
for (const part of parts) seconds = seconds * 60 + part;
output.seconds = seconds;
output.max = seconds + Number(EXTRA);
output.later = seconds + Number(LATER);

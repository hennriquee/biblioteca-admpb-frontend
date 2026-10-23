import { createSuggestStory } from "./index.js";

const params = new URLSearchParams(location.search);
const W = Number(params.get("w") || 800);
const H = Number(params.get("h") || 500);
const PX = Number(params.get("px") || 1);
const canvas = document.getElementById("c");
canvas.style.width = W + "px";
canvas.style.height = H + "px";
const started = performance.now();
const story = createSuggestStory(canvas);
story.resize(W, H, PX);
window.story = story;
window.renderAt = (t) => { story.draw(t); return true; };
story.ready.then(() => {
  window.compileMs = performance.now() - started;
  window.renderAt(Number(params.get("t") || 0));
  window.ready = true;
});

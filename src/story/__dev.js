import { createSuggestStory } from "./index.js";

const params = new URLSearchParams(location.search);
const W = Number(params.get("w") || 800);
const H = Number(params.get("h") || 500);
const PX = Number(params.get("px") || 1);
const canvas = document.getElementById("c");
canvas.style.width = W + "px";
canvas.style.height = H + "px";
const story = createSuggestStory(canvas, { title: params.get("title") || "O Peregrino" });
story.resize(W, H, PX);
window.story = story;
window.renderAt = (t) => { story.draw(t, params.get("first") === "1"); return true; };
window.renderAt(Number(params.get("t") || 0));
window.ready = true;

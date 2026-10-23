import * as THREE from "three";
import { createSketchRenderer } from "./sketch.js";
import { part } from "./kit.js";
import { makeBoy, makeCourier } from "./cast.js";
import { applyPose, full } from "./pose.js";

const params = new URLSearchParams(location.search);
const W = Number(params.get("w") || 800);
const H = Number(params.get("h") || 500);
const canvas = document.getElementById("c");
canvas.style.width = W + "px";
canvas.style.height = H + "px";
const sk = createSketchRenderer(canvas);
sk.setSize(W, H, 1);
const scene = new THREE.Scene();
const m = sk.material;
part(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), m, { tone: 0.05 }, scene);
const who = params.get("who") || "boy";
const rig = who === "boy" ? makeBoy(m) : makeCourier(m);
scene.add(rig.root);
const faces = {
  neutral: {},
  joy: { face: { squint: 1, smile: 1, open: 0.9, brow: 1, eye: 0.4 }, neck: [-0.15, 0, 0] },
  wow: { face: { eye: 1.3, brow: 1.1, open: 0.8, smile: 0.3 } },
  worry: { face: { worry: 0.8, smile: -0.4, eye: 1.1, lookX: 0.6 } },
  look: { face: { lookY: -0.8, brow: 0.5 }, neck: [0.4, 0, 0] },
};
applyPose(rig, full(faces[params.get("face") || "neutral"]));
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
const head = who === "boy" ? 1.18 : 1.6;
const views = {
  front: [[0.25, head, 1.0], [0, head, 0]],
  back: [[-0.35, head - 0.15, -1.4], [0, head - 0.05, 0]],
  full: [[0.8, 0.85, 3.2], [0, 0.7, 0]],
  side: [[1.0, head, 0.2], [0, head, 0]],
};
const v = views[params.get("view") || "front"];
camera.position.set(...v[0]);
camera.lookAt(...v[1]);
const sun = { dir: new THREE.Vector3(-0.62, 0.42, 0.66).normalize(), center: new THREE.Vector3(0, 1, 0), radius: 3 };
window.renderAt = (t) => {
  sk.render(scene, camera, sun, { boil: Math.floor(t * 8) % 3, reveal: 1, sky: 1, focus: 3 });
  return true;
};
window.renderAt(0);
window.ready = true;

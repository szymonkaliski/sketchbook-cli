const regl = require("regl")();

regl.clear({ color: [0.0, 0.0, 0.0, 1.0] });

if (window.sketchbook) {
  setTimeout(() => {
    window.sketchbook.shot();
  }, 10);
}

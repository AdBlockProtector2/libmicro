"use strict";
(async () => {
    Micro.debug = true;
    await Micro.setConfig(`
||example.com^$document,important
||example.com^$libmicro,inject=hello-world.js
`);
    await Micro.setAssets(`
libmicro-frame-blocked text/html
<!DOCTYPE html>
<html>
<head>
  <title>Frame Blocked</title>
</head>
<body>
  <h1>libmicro blocked this frame</h1>
</body>
</html>

hello-world.js text/javascript
console.log("Hello from libmicro");
`);
    await Micro.init();
})();
//# sourceMappingURL=example.js.map
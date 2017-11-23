"use strict";

(async () => {

    const instance = new Micro.Micro("Test_Instance");

    // Activate debug mode, do not do this in production
    instance.debug = true;

    // libmicro use Adblock Plus style filter lists, with a few
    // differences
    //
    // libmicro does not parse white lists as it is designed to assist
    // a main firewall, instead of taking the whole task itself
    //
    // Some options Adblock Plus supports are not accepted by libmicro
    // and vice versa, play around with it to find out the difference
    //
    // The filtering logic is also somewhat different, filters will
    // not work out of the box, you are responsible in transpiling
    // the filters if needed
    await instance.setFilters(`
||test.example.com^$document,important
||test2.example.com^$libmicro,redirect=hello-world.html
||example.com^$libmicro,inject=hello-world.js
`);

    // libmicro use uBlock Origin style scriptlet resources
    //
    // Quantum does not allow cancellation of document request, have
    // a special asset entry named "libmicro-frame-blocked" to
    // workaround this problem
    // You can customize that page the way you like
    await instance.setAssets(`
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

hello-world.html text/html
<!DOCTYPE html>
<html>
<head>
  <title>Hello from libmicro</title>
</head>
<body>
  <h1>Hello from libmicro</h1>
</body>
</html>

hello-world.js text/javascript
const hello_text = "Hello from libmicro";
console.log(hello_text);
`);

    // setConfig and setAssets can run in parallel, but you must
    // wait for both of them to complete before calling init

    // setConfig and setAssets persist across browser restarts,
    // but are not synced across connected devices

    // Initialize libmicro
    await instance.init();

    // Call this function when you wants to disable libmicro
    //instance.teardown();

})();
